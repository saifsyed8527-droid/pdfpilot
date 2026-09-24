import type { ExcelInspection, ExcelOptions, ExcelOutput } from "./excel-conversion-engine";

export function runExcelWorker<T extends "inspect" | "convert">(type: T, file: File, options: ExcelOptions, signal: AbortSignal, onProgress?: (value: number) => void): Promise<T extends "inspect" ? ExcelInspection : ExcelOutput[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    const worker = new Worker(new URL("../../workers/excel-conversion.worker.ts", import.meta.url));
    const cleanup = () => { worker.terminate(); signal.removeEventListener("abort", abort); clearTimeout(timeout); };
    const abort = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error("This workbook took too long. Try fewer sheets or a smaller file.")); }, 180_000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") { onProgress?.(data.progress); return; }
      cleanup();
      if (data.type === "error") reject(new Error(data.error));
      else resolve(data.result);
    };
    worker.onerror = () => { cleanup(); reject(new Error("The conversion worker could not start. Refresh the page and try again.")); };
    worker.postMessage({ type, file, options });
  });
}
