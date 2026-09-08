import "server-only";

import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { LookupFunction } from "node:net";

type PublicResponse = {
  bytes: Uint8Array;
  contentType: string;
  finalUrl: string;
  status: number;
};

function isPrivateAddress(address: string) {
  const value = address.toLowerCase().split("%")[0];
  if (value.startsWith("::ffff:")) return isPrivateAddress(value.slice(7));
  if (net.isIPv4(value)) {
    const [a, b] = value.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0);
  }
  if (net.isIPv6(value)) {
    return value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") ||
      /^fe[89ab]/.test(value) || value.startsWith("ff") || value.startsWith("2001:db8:");
  }
  return true;
}

async function resolvePublicAddress(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("Only public http and https URLs are supported.");
  }
  const expectedPort = url.protocol === "https:" ? "443" : "80";
  if (url.port && url.port !== expectedPort) throw new Error("Only standard web ports are supported.");

  if (net.isIP(url.hostname)) {
    if (isPrivateAddress(url.hostname)) throw new Error("Private network addresses are not supported.");
    return { address: url.hostname, family: net.isIPv6(url.hostname) ? 6 : 4 };
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("This address is not available for public import.");
  }
  return addresses[0];
}

export async function safePublicFetch(rawUrl: string, maxBytes: number, redirects = 0): Promise<PublicResponse> {
  if (redirects > 4) throw new Error("Too many redirects.");
  const url = new URL(rawUrl);
  const resolved = await resolvePublicAddress(url);
  const transport = url.protocol === "https:" ? https : http;
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, [resolved]);
    else callback(null, resolved.address, resolved.family);
  };

  return new Promise<PublicResponse>((resolve, reject) => {
    const request = transport.request(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,text/css,image/avif,image/webp,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 PDFPilot HTML to PDF",
      },
      servername: url.protocol === "https:" && !net.isIP(url.hostname) ? url.hostname : undefined,
      lookup: pinnedLookup,
    }, (response) => {
      const status = response.statusCode ?? 500;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        const nextUrl = new URL(response.headers.location, url);
        safePublicFetch(nextUrl.toString(), maxBytes, redirects + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`The website responded with ${status}.`));
        return;
      }
      const declaredSize = Number(response.headers["content-length"] ?? 0);
      if (declaredSize > maxBytes) {
        response.destroy();
        reject(new Error("This resource is too large to import."));
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          response.destroy(new Error("This resource is too large to import."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        bytes: new Uint8Array(Buffer.concat(chunks)),
        contentType: String(response.headers["content-type"] ?? "application/octet-stream").split(";")[0].trim().toLowerCase(),
        finalUrl: url.toString(),
        status,
      }));
      response.on("error", reject);
    });
    request.setTimeout(15_000, () => request.destroy(new Error("The website took too long to respond.")));
    request.on("error", reject);
    request.end();
  });
}
