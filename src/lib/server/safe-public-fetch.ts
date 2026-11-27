import "server-only";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net, { type LookupFunction } from "node:net";

type PublicResponse = {
  bytes: Uint8Array;
  contentType: string;
  contentDisposition?: string;
  finalUrl: string;
  status: number;
};
class ImportError extends Error {}
let active = 0;
const DEADLINE_MS = 25_000;
const MAX_CONCURRENT = 8;

export function isPrivateAddress(address: string) {
  const value = address.toLowerCase();
  if (net.isIPv4(value)) {
    const [a, b, c] = value.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113);
  }
  if (net.isIPv6(value) && !value.includes("%")) {
    const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
    const [first, second = "0"] = normalized.split(":").map(part => part || "0");
    const a = parseInt(first, 16), b = parseInt(second, 16);
    // Only global unicast; excludes mapped IPv4, NAT64, local, multicast and
    // transition/documentation ranges that can conceal a non-public target.
    return a < 0x2000 || a > 0x3fff || a === 0x2002 || a === 0x3fff ||
      (a === 0x2001 && (b < 0x200 || b === 0xdb8));
  }
  return true;
}

async function resolvePublicAddress(url: URL, signal: AbortSignal) {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new ImportError("Only public http and https URLs are supported.");
  if (url.port && url.port !== (url.protocol === "https:" ? "443" : "80"))
    throw new ImportError("Only standard web ports are supported.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!hostname || hostname.length > 253) throw new ImportError("Invalid public hostname.");
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new ImportError("Private network addresses are not supported.");
    return { address: hostname, family: net.isIP(hostname) };
  }
  // DNS itself is included in the total deadline. No connection is made after
  // cancellation, even if the operating system finishes DNS later.
  let abort = () => {};
  try {
    signal.throwIfAborted();
    const addresses = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
      }),
    ]);
    signal.throwIfAborted();
    if (!addresses.length || addresses.some(entry => isPrivateAddress(entry.address)))
      throw new ImportError("This address is not available for public import.");
    return addresses[0];
  } finally { signal.removeEventListener("abort", abort); }
}

async function fetchHop(rawUrl: string, maxBytes: number, signal: AbortSignal, redirects = 0): Promise<PublicResponse> {
  signal.throwIfAborted();
  if (redirects > 4) throw new ImportError("Too many redirects.");
  if (rawUrl.length > 2048) throw new ImportError("URL is too long.");
  const url = new URL(rawUrl);
  const resolved = await resolvePublicAddress(url, signal);
  signal.throwIfAborted();
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, [resolved]);
    else callback(null, resolved.address, resolved.family);
  };
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).request(url, {
      method: "GET", signal, lookup: pinnedLookup, agent: false,
      headers: { Accept: "*/*", "Accept-Encoding": "identity", "User-Agent": "PDFPilot public import" },
    }, response => {
      let discarded = false;
      const discard = () => { discarded = true; response.destroy(); };
      response.on("error", error => { if (!discarded) reject(error); });
      response.on("aborted", () => { if (!discarded) reject(new ImportError("The website returned an incomplete response.")); });
      const status = response.statusCode ?? 500;
      if (status >= 300 && status < 400 && response.headers.location) {
        let nextUrl: URL;
        try { nextUrl = new URL(response.headers.location, url); }
        catch { discard(); reject(new ImportError("Invalid website redirect.")); return; }
        // Never drain an unbounded redirect/error body.
        discard();
        fetchHop(nextUrl.href, maxBytes, signal, redirects + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        discard(); reject(new ImportError(`The website responded with ${status}.`)); return;
      }
      const encoding = response.headers["content-encoding"];
      if (encoding && encoding !== "identity") {
        discard(); reject(new ImportError("This website returned an unsupported compressed response.")); return;
      }
      if (Number(response.headers["content-length"] ?? 0) > maxBytes) {
        discard(); reject(new ImportError("This resource is too large to import.")); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { response.destroy(new ImportError("This resource is too large to import.")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        bytes: new Uint8Array(Buffer.concat(chunks, size)),
        contentType: String(response.headers["content-type"] ?? "application/octet-stream").split(";")[0].trim().toLowerCase(),
        contentDisposition: response.headers["content-disposition"], finalUrl: url.href, status,
      }));
    });
    request.setTimeout(10_000, () => request.destroy(new ImportError("The website took too long to respond.")));
    request.on("error", reject);
    request.end();
  });
}

export async function safePublicFetch(rawUrl: string, maxBytes: number, clientSignal?: AbortSignal): Promise<PublicResponse> {
  if (active >= MAX_CONCURRENT) throw new ImportError("Imports are busy. Please try again shortly.");
  active++;
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, DEADLINE_MS);
  clientSignal?.addEventListener("abort", abort, { once: true });
  if (clientSignal?.aborted) abort();
  try {
    return await fetchHop(rawUrl, maxBytes, controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new ImportError("The import was cancelled or took too long.");
    if (error instanceof ImportError) throw error;
    // Never echo OS errors, DNS names, socket addresses or certificate details.
    throw new ImportError("Could not import this public URL. Check the link and try again.");
  } finally {
    clearTimeout(timer);
    clientSignal?.removeEventListener("abort", abort);
    active--;
  }
}
