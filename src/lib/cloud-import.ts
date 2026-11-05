export type CloudProvider = "google-drive" | "dropbox";
export const CLOUD_IMPORT_LIMIT = 4 * 1024 * 1024;
const exportFormats = new Set(["pdf", "docx", "xlsx", "csv", "txt", "pptx"]);

/** Only file-share links are accepted. Authentication stays with the provider. */
export function cloudDownload(raw: string, provider: CloudProvider, preferredFormat = "pdf") {
  const url = new URL(raw.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.href.length > 2048) {
    throw new Error("Enter an HTTPS file sharing link.");
  }
  if (provider === "dropbox") {
    if (!["www.dropbox.com", "dropbox.com"].includes(url.hostname) || !/^\/(?:s\/|scl\/fi\/)/.test(url.pathname)) {
      throw new Error("Enter a Dropbox shared file link.");
    }
    url.searchParams.delete("raw");
    url.searchParams.set("dl", "1");
    url.hash = "";
    return { url: url.href, name: decodeURIComponent(url.pathname.split("/").at(-1) || "dropbox-file"), format: undefined };
  }
  if (!["drive.google.com", "docs.google.com"].includes(url.hostname)) {
    throw new Error("Enter a Google Drive, Docs, Sheets or Slides file link.");
  }
  const document = url.hostname === "docs.google.com" && url.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
  if (document) {
    const [, kind, id] = document;
    const allowed = kind === "spreadsheets" ? ["xlsx", "csv", "pdf"] : kind === "presentation" ? ["pptx", "pdf", "txt"] : ["docx", "pdf", "txt"];
    const format = exportFormats.has(preferredFormat) && allowed.includes(preferredFormat) ? preferredFormat : allowed[0];
    const endpoint = kind === "presentation" ? `https://docs.google.com/presentation/d/${id}/export/${format}` : `https://docs.google.com/${kind}/d/${id}/export?format=${format}`;
    return { url: endpoint, name: `google-${kind}.${format}`, format };
  }
  const id = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1] ?? url.searchParams.get("id");
  if (!id || !/^[a-zA-Z0-9_-]{10,200}$/.test(id)) throw new Error("Enter a Google Drive file link, rather than a folder link.");
  const endpoint = new URL("https://drive.usercontent.google.com/download");
  endpoint.searchParams.set("id", id);
  endpoint.searchParams.set("export", "download");
  const resourceKey = url.searchParams.get("resourcekey");
  if (resourceKey && /^[a-zA-Z0-9_-]{1,200}$/.test(resourceKey)) endpoint.searchParams.set("resourcekey", resourceKey);
  return { url: endpoint.href, name: "google-drive-file", format: undefined };
}

export function cloudFileName(disposition: string | undefined, fallback: string) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename="([^"]+)"|filename=([^;]+)/i);
  let name = plain?.[1] ?? plain?.[2] ?? fallback;
  if (encoded) {
    try { name = decodeURIComponent(encoded); } catch { /* Keep the ordinary filename. */ }
  }
  return name.replace(/[\x00-\x1f\x7f/\\]/g, "_").trim().slice(0, 180) || "imported-file";
}
