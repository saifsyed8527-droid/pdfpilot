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
  if (options.signal?.aborted) throw aborted();
  if (!file.size || file.size > 50 * 1024 * 1024)
    throw new Error("Choose a non-empty PDF up to 50MB.");
  const bytes = await file.arrayBuffer();
  if (options.signal?.aborted) throw aborted();
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined,
      settled = false;
    const finish = () => {
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      worker?.terminate();
    };
    const abort = () => {
      finish();
      reject(aborted());
    };
    const timer = setTimeout(() => {
      finish();
      reject(
        new Error(
          "This PDF took too long to process. Choose a smaller document and retry.",
        ),
      );
    }, 180000);
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      worker = new Worker("/qpdf/worker.js");
      worker.onmessage = ({ data }) => {
        if (settled) return;
        if (data.type === "progress") {
          options.onProgress?.(data.percent, data.message);
          return;
        }
        finish();
        if (data.type === "error") reject(new Error(data.message));
        else {
          const { bytes: output, ...report } = data.result;
          resolve({
            ...report,
            blob: new Blob([output], { type: "application/pdf" }),
          });
        }
      };
      worker.onerror = () => {
        if (settled) return;
        finish();
        reject(
          new Error(
            "The PDF engine could not start. Refresh or use a current browser and try again.",
          ),
        );
      };
      const { signal: _signal, onProgress: _progress, ...settings } = options;
      worker.postMessage({ bytes, options: settings }, [bytes]);
    } catch (error) {
      finish();
      reject(error);
    }
  });
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
