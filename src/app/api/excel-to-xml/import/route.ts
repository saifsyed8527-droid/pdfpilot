import { NextResponse } from "next/server";
import { safePublicFetch } from "@/lib/server/safe-public-fetch";
import { checkRateLimit, readLimitedJson } from "@/lib/server/request-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, "excel-import", 10);
    if (!rate.allowed) return NextResponse.json({ error: "Too many imports. Try again shortly." }, { status: 429 });
    const parsed = await readLimitedJson<{ url?: unknown }>(request, 4096);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    if (typeof parsed.value?.url !== "string") throw new Error("Enter a public workbook URL.");
    const url = new URL(parsed.value.url);
    if (url.href.length > 2048) throw new Error("The URL is too long.");
    // Keep binary responses below the hosting platform's response-size limit.
    const response = await safePublicFetch(url.href, 4 * 1024 * 1024);
    const bytes = response.bytes;
    const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    const compound = bytes[0] === 0xd0 && bytes[1] === 0xcf;
    if (!zip && !compound) throw new Error("This link does not return an Excel file. Use a direct download link, not a sharing page.");
    const originalName = decodeURIComponent(new URL(response.finalUrl).pathname.split("/").pop() || "");
    const extension = /\.(xlsx|xls)$/i.exec(originalName)?.[1]?.toLowerCase() || (zip ? "xlsx" : "xls");
    const name = originalName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 100) || "imported";
    return new NextResponse(bytes as BodyInit, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${name}.${extension}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not import this URL." }, { status: 400 });
  }
}
