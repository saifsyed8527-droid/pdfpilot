import { NextResponse } from "next/server";
import { safePublicFetch } from "@/lib/server/safe-public-fetch";
import { checkApiRateLimit } from "@/lib/server/request-guard";

export const runtime = "nodejs";

const MAX_ASSET_BYTES = 4 * 1024 * 1024;

function proxiedAssetUrl(value: string, baseUrl: string, origin: string) {
  const raw = value.trim().replace(/^['"]|['"]$/g, "");
  if (!raw || /^(data:|blob:|#)/i.test(raw)) return value;
  try {
    const absolute = new URL(raw, baseUrl);
    if (!['http:', 'https:'].includes(absolute.protocol)) return value;
    return `${origin}/api/html-to-pdf/asset?url=${encodeURIComponent(absolute.toString())}`;
  } catch {
    return value;
  }
}

function rewriteCssAssets(css: string, baseUrl: string, origin: string) {
  return css
    .replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (_match, _quote, value) => `url("${proxiedAssetUrl(value, baseUrl, origin)}")`)
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (_match, quote, value) => `@import ${quote}${proxiedAssetUrl(value, baseUrl, origin)}${quote}`);
}

export async function GET(request: Request) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site")
      return NextResponse.json({ error: "Cross-site asset imports are not allowed." }, { status: 403 });
    const rate = await checkApiRateLimit(request, "asset-fetch", 120);
    if (!rate.allowed) {
      return NextResponse.json({ error: rate.unavailable ? "Imports are temporarily unavailable. Try again shortly." : "Too many requests. Please try again shortly." }, { status: rate.unavailable ? 503 : 429, headers: { "Retry-After": String(rate.retryAfter) } });
    }
    const rawUrl = new URL(request.url).searchParams.get("url");
    if (!rawUrl) return NextResponse.json({ error: "Missing asset URL." }, { status: 400 });
    if (rawUrl.length > 2048) return NextResponse.json({ error: "URL is too long." }, { status: 400 });
    const response = await safePublicFetch(rawUrl, MAX_ASSET_BYTES, request.signal);
    const allowed = response.contentType.startsWith("image/") || response.contentType.startsWith("font/") ||
      response.contentType === "text/css" || response.contentType.includes("font") || response.contentType === "application/octet-stream";
    if (!allowed) return NextResponse.json({ error: "Unsupported website asset." }, { status: 415 });

    const body: BodyInit = response.contentType === "text/css"
      ? rewriteCssAssets(new TextDecoder().decode(response.bytes), response.finalUrl, new URL(request.url).origin)
      : new Blob([response.bytes as unknown as BlobPart], { type: response.contentType || "application/octet-stream" });
    if (typeof body === "string" && Buffer.byteLength(body) > MAX_ASSET_BYTES)
      return NextResponse.json({ error: "This stylesheet is too large to import." }, { status: 413 });
    return new NextResponse(body, {
      headers: {
        "Content-Type": response.contentType || "application/octet-stream",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        // Remote SVGs remain passive assets, even when opened as a document.
        // No script or same-origin permission: never inherit app storage access.
        "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && !(error instanceof TypeError) ? error.message : "Could not load this website asset." }, { status: 400 });
  }
}
