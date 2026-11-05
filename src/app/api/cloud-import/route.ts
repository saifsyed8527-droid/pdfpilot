import { NextResponse } from "next/server";
import { safePublicFetch } from "@/lib/server/safe-public-fetch";
import { checkRateLimit, readLimitedJson } from "@/lib/server/request-guard";
import { cloudDownload, cloudFileName, CLOUD_IMPORT_LIMIT } from "@/lib/cloud-import";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const rate = checkRateLimit(request, "cloud-import", 30);
  if (!rate.allowed) return NextResponse.json({ error: "Too many imports. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  const parsed = await readLimitedJson<{ url: string; provider: string; format?: string }>(request, 4096);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  try {
    const { url, provider, format } = parsed.value;
    if (typeof url !== "string" || !["google-drive", "dropbox"].includes(provider) || (format !== undefined && typeof format !== "string")) {
      throw new Error("Choose a provider and enter its shared file link.");
    }
    const download = cloudDownload(url, provider as "google-drive" | "dropbox", format);
    const response = await safePublicFetch(download.url, CLOUD_IMPORT_LIMIT);
    const prefix = new TextDecoder().decode(response.bytes.subarray(0, 512)).trimStart();
    if (!response.bytes.length) throw new Error("The shared file is empty.");
    const attachedHTML = /^attachment(?:;|$)/i.test(response.contentDisposition ?? "") && /\.x?html?$/i.test(cloudFileName(response.contentDisposition, ""));
    if (!attachedHTML && (/^text\/html/i.test(response.contentType) || /^(?:<!doctype\s+html|<html[\s>])/i.test(prefix))) {
      throw new Error("This link requires sign-in or download confirmation. Use a shared file link that allows downloading, or download the file and select it from your device.");
    }
    let name = cloudFileName(response.contentDisposition, download.name);
    if (!/\.[a-z0-9]{1,8}$/i.test(name)) {
      const extensions: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "text/csv": "csv", "text/plain": "txt", "application/json": "json", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx" };
      const extension = extensions[response.contentType] ?? download.format;
      if (extension) name += "." + extension;
    }
    return new NextResponse(response.bytes as BodyInit, { headers: {
      "Content-Type": response.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, char => "%" + char.charCodeAt(0).toString(16))}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The file could not be imported." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
