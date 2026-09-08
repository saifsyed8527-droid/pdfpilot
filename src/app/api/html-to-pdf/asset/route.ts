import { NextResponse } from "next/server";
import { safePublicFetch } from "@/lib/server/safe-public-fetch";

export const runtime = "nodejs";

const MAX_ASSET_BYTES = 12 * 1024 * 1024;

function proxiedAssetUrl(value: string, baseUrl: string) {
  const raw = value.trim().replace(/^['"]|['"]$/g, "");
  if (!raw || /^(data:|blob:|#)/i.test(raw)) return value;
  try {
    const absolute = new URL(raw, baseUrl);
    if (!['http:', 'https:'].includes(absolute.protocol)) return value;
    return `/api/html-to-pdf/asset?url=${encodeURIComponent(absolute.toString())}`;
  } catch {
    return value;
  }
}

function rewriteCssAssets(css: string, baseUrl: string) {
  return css
    .replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (_match, _quote, value) => `url("${proxiedAssetUrl(value, baseUrl)}")`)
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (_match, quote, value) => `@import ${quote}${proxiedAssetUrl(value, baseUrl)}${quote}`);
}

export async function GET(request: Request) {
  try {
    const rawUrl = new URL(request.url).searchParams.get("url");
    if (!rawUrl) return NextResponse.json({ error: "Missing asset URL." }, { status: 400 });
    const response = await safePublicFetch(rawUrl, MAX_ASSET_BYTES);
    const allowed = response.contentType.startsWith("image/") || response.contentType.startsWith("font/") ||
      response.contentType === "text/css" || response.contentType.includes("font") || response.contentType === "application/octet-stream";
    if (!allowed) return NextResponse.json({ error: "Unsupported website asset." }, { status: 415 });

    const body: BodyInit = response.contentType === "text/css"
      ? rewriteCssAssets(new TextDecoder().decode(response.bytes), response.finalUrl)
      : new Blob([response.bytes as unknown as BlobPart], { type: response.contentType || "application/octet-stream" });
    return new NextResponse(body, {
      headers: {
        "Content-Type": response.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load this website asset." }, { status: 400 });
  }
}
