import type { ExcelInspection, ExcelOptions, ExcelOutput } from "./excel-conversion-engine";

export function runExcelWorker<T extends "inspect" | "convert">(type: T, file: File, options: ExcelOptions, signal: AbortSignal, onProgress?: (value: number) => void): Promise<T extends "inspect" ? ExcelInspection : ExcelOutput[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    let worker: Worker | undefined;
    let stopped = false;
    const cleanup = () => { stopped = true; worker?.terminate(); signal.removeEventListener("abort", abort); clearTimeout(timeout); };
    const abort = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error("This workbook took too long. Try fewer sheets or a smaller file.")); }, 180_000);
    signal.addEventListener("abort", abort, { once: true });
    if (type === "convert" && options.format === "pdf") {
      // PDF metadata, pictures and charts need the browser DOM/canvas. The
      // data exports and workbook inspection continue in a dedicated worker.
      void (async () => {
        try {
          const { convertExcel } = await import("./excel-conversion-engine");
          if (stopped) return;
          const result = await convertExcel(file, options, value => { if (!stopped) onProgress?.(value); }, () => stopped);
          if (stopped) return;
          cleanup();
          resolve(result as T extends "inspect" ? ExcelInspection : ExcelOutput[]);
        } catch (error) {
          if (stopped) return;
          cleanup(); reject(error);
        }
      })();
      return;
    }
    try {
      worker = new Worker(new URL("../../workers/excel-conversion.worker.ts", import.meta.url));
    } catch (error) { cleanup(); reject(error); return; }
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
