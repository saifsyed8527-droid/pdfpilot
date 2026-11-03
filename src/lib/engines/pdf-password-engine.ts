import { runQpdfWorker } from "./qpdf-worker";
import { safeBaseName } from "./pdf-split-engine";

export interface PdfPasswordOptions {
  operation: "lock" | "unlock";
  currentPassword?: string;
  openPassword?: string;
  ownerPassword?: string;
  print?: "full" | "low" | "none";
  modify?: "all" | "form" | "none";
  copy?: boolean;
  signal?: AbortSignal;
  onProgress?: (percent: number, message: string) => void;
}
export interface PdfPasswordResult {
  blob: Blob;
  pageCount: number;
  fieldCount: number;
  wasEncrypted: boolean;
  unchanged: boolean;
  encryption: "AES-256" | "none";
}
const aborted = () => new DOMException("Processing cancelled", "AbortError");
export const passwordFilename = (name: string, operation: "lock" | "unlock") =>
  `${safeBaseName(name)}-${operation === "lock" ? "protected" : "unlocked"}.pdf`;

export async function processPdfPassword(
  file: File,
  options: PdfPasswordOptions,
): Promise<PdfPasswordResult> {
  return runQpdfWorker<Omit<PdfPasswordResult, "blob">>(file, { ...options });
}

export async function passwordZip(
  entries: { name: string; blob: Blob }[],
  signal?: AbortSignal,
): Promise<Blob> {
  if (
    !entries.length ||
    entries.length > 20 ||
    entries.reduce((n, e) => n + e.blob.size, 0) > 200 * 1024 * 1024
  )
    throw new Error("Download up to 20 completed PDFs and 200MB at a time.");
  const files: Record<string, Uint8Array> = Object.create(null);
  for (const [i, entry] of entries.entries()) {
    if (signal?.aborted) throw aborted();
    files[`${i + 1}_${safeBaseName(entry.name)}.pdf`] = new Uint8Array(
      await entry.blob.arrayBuffer(),
    );
  }
  const { zip } = await import("fflate");
  if (signal?.aborted) throw aborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      terminate();
      signal?.removeEventListener("abort", abort);
      reject(aborted());
    };
    const terminate = zip(files, { level: 0 }, (error, bytes) => {
      signal?.removeEventListener("abort", abort);
      if (signal?.aborted) reject(aborted());
      else if (error) reject(error);
      else
        resolve(
          new Blob([new Uint8Array(bytes).buffer], { type: "application/zip" }),
        );
    });
    signal?.addEventListener("abort", abort, { once: true });
  });
}
