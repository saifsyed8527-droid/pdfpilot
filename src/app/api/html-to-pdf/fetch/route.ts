import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_HTML_BYTES = 5 * 1024 * 1024;

function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (/^(0|10|127)\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return true;
  return false;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const rawUrl = body.url?.trim();
    if (!rawUrl) return NextResponse.json({ error: "Please enter a website URL." }, { status: 400 });

    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only http and https URLs are supported." }, { status: 400 });
    }
    if (parsed.username || parsed.password || isBlockedHostname(parsed.hostname)) {
      return NextResponse.json({ error: "Please use a public website URL." }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 PDFPilot HTML to PDF",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ error: `The website responded with ${response.status}.` }, { status: 400 });
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_HTML_BYTES) {
      return NextResponse.json({ error: "This page is too large to import right now." }, { status: 413 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_HTML_BYTES) {
      return NextResponse.json({ error: "This page is too large to import right now." }, { status: 413 });
    }

    const html = new TextDecoder("utf-8").decode(arrayBuffer);
    return NextResponse.json({ html, finalUrl: response.url || parsed.toString() });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "The website took too long to respond."
        : "Could not load this URL. Please check it and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
