import "server-only";
import { BlockList, isIP } from "node:net";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
let lastSweep = 0;

// Official Cloudflare origin ranges, checked 2026-11-27:
// https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
// This identifies shared proxy egress, NOT a visitor or an authorized zone.
const cloudflare = new BlockList();
for (const cidr of [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
  "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
  "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22", "2400:cb00::/32",
  "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32",
  "2a06:98c0::/29", "2c0f:f248::/32",
]) {
  const [address, prefix] = cidr.split("/");
  cloudflare.addSubnet(address, Number(prefix), isIP(address) === 6 ? "ipv6" : "ipv4");
}

// Vercel overwrites this header at its trusted edge. Other hosts share a
// conservative bucket until a trusted proxy is explicitly implemented.
function clientKey(request: Request, scope: string) {
  const candidate = process.env.VERCEL === "1"
    ? request.headers.get("x-vercel-forwarded-for")?.trim()
    : undefined;
  const ip = candidate && isIP(candidate) ? candidate : "shared";
  const proxy = ip !== "shared" && cloudflare.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
  return { key: `${scope}:${ip}`, proxy };
}

// Per-instance backstop, NOT a replacement for a Vercel Firewall rate rule.
export function checkRateLimit(request: Request, scope: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  if (now - lastSweep >= 60_000 || buckets.size >= MAX_BUCKETS) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
    lastSweep = now;
  }
  const { key, proxy } = clientKey(request, scope);
  // Cloudflare enforces the visitor limit at its edge. Keep a bounded aggregate
  // backstop here without treating shared egress as a single 10/min visitor.
  // Never trust CF-Connecting-IP: other Cloudflare customers can send headers.
  if (proxy) limit = Math.max(limit, 1200);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (!current && buckets.size >= MAX_BUCKETS) return { allowed: false, retryAfter: 60 };
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count < limit) {
    current.count++;
    return { allowed: true, retryAfter: 0 };
  }
  return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

export function exceedsDeclaredSize(request: Request, maxBytes: number) {
  const value = request.headers.get("content-length");
  if (value === null) return false;
  return !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maxBytes;
}

type JsonBodyResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 403 | 408 | 413 | 415; error: string };

export async function readLimitedJson<T>(request: Request, maxBytes: number, allowedKeys?: readonly string[]): Promise<JsonBodyResult<T>> {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin !== null && origin !== new URL(request.url).origin)) {
    return { ok: false, status: 403, error: "Cross-origin imports are not allowed." };
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { ok: false, status: 415, error: "Content-Type must be application/json." };
  }
  if (exceedsDeclaredSize(request, maxBytes)) return { ok: false, status: 413, error: "Request is too large." };
  if (!request.body) return { ok: false, status: 400, error: "Request body must contain a JSON object." };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let expired = false;
  const cancel = () => { expired = true; void reader.cancel().catch(() => {}); };
  request.signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 5_000);
  try {
    if (request.signal.aborted) cancel();
    while (true) {
      const { done, value } = await reader.read();
      if (expired) return { ok: false, status: 408, error: "Request was cancelled or took too long." };
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: "Request is too large." };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).some(key => ["__proto__", "constructor", "prototype"].includes(key) || (allowedKeys && !allowedKeys.includes(key)))) {
      return { ok: false, status: 400, error: "Request contains unsupported fields or is not an object." };
    }
    return { ok: true, value: value as T };
  } catch {
    return { ok: false, status: 400, error: "Request body must contain a valid JSON object." };
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
