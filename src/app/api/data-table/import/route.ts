import { NextResponse } from "next/server";
import { safePublicFetch } from "@/lib/server/safe-public-fetch";
import { checkRateLimit, readLimitedJson } from "@/lib/server/request-guard";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, "data-table-import", 10);
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Too many imports. Try again shortly." },
        { status: 429 },
      );
    const parsed = await readLimitedJson<{ url?: unknown; format?: unknown }>(
      request,
      4096,
    );
    if (!parsed.ok)
      return NextResponse.json(
        { error: parsed.error },
        { status: parsed.status },
      );
    if (
      typeof parsed.value?.url !== "string" ||
      !["xml", "csv"].includes(String(parsed.value.format))
    )
      throw new Error("Enter a public XML or CSV download URL.");
    const url = new URL(parsed.value.url);
    if (url.href.length > 2048) throw new Error("The URL is too long.");
    const response = await safePublicFetch(url.href, 4 * 1024 * 1024);
    const start = new TextDecoder()
      .decode(response.bytes.subarray(0, 1000))
      .trimStart();
    if (
      /^text\/html/i.test(response.contentType) ||
      /^(?:<!doctype\s+html|<html[\s>])/i.test(start)
    )
      throw new Error(
        "This link returns a web page. Use a direct XML or CSV download link.",
      );
    if (!response.bytes.length)
      throw new Error("This link returned an empty file.");
    const original = decodeURIComponent(
      new URL(response.finalUrl).pathname.split("/").pop() || "",
    );
    const name =
      original
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_.-]/g, "_")
        .slice(0, 100) || "imported";
    return new NextResponse(response.bytes as BodyInit, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}.${parsed.value.format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not import this URL.",
      },
      { status: 400 },
    );
  }
}
