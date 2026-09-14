import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientKey(request: Request, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  return `${scope}:${ip}`;
}

export function checkRateLimit(request: Request, scope: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const key = clientKey(request, scope);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  current.count += 1;
  if (current.count <= limit) return { allowed: true, retryAfter: 0 };
  return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

export function exceedsDeclaredSize(request: Request, maxBytes: number) {
  const value = request.headers.get("content-length");
  if (!value) return false;
  const length = Number(value);
  return !Number.isFinite(length) || length < 0 || length > maxBytes;
}

type JsonBodyResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 413; error: string };

export async function readLimitedJson<T>(request: Request, maxBytes: number): Promise<JsonBodyResult<T>> {
  if (exceedsDeclaredSize(request, maxBytes)) {
    return { ok: false, status: 413, error: "Request is too large." };
  }

  if (!request.body) {
    return { ok: false, status: 400, error: "Request body must contain valid JSON." };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { ok: false, status: 413, error: "Request is too large." };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as T };
  } catch {
    return { ok: false, status: 400, error: "Request body must contain valid JSON." };
  }
}
