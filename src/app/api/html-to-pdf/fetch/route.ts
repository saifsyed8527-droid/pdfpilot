import { NextResponse } from "next/server";
import { safePublicFetch } from "@/lib/server/safe-public-fetch";

export const runtime = "nodejs";

const MAX_HTML_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const rawUrl = body.url?.trim();
    if (!rawUrl) return NextResponse.json({ error: "Please enter a website URL." }, { status: 400 });

    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only http and https URLs are supported." }, { status: 400 });
    }
    const response = await safePublicFetch(parsed.toString(), MAX_HTML_BYTES);
    if (!response.contentType.includes("html") && !response.contentType.includes("xml")) {
      return NextResponse.json({ error: "This URL did not return an HTML page." }, { status: 400 });
    }
    const html = new TextDecoder("utf-8").decode(response.bytes);
    return NextResponse.json({ html, finalUrl: response.finalUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load this URL. Please check it and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
