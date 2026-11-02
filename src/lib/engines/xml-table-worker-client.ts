import type { TableData, exportTable } from "./xml-table-engine";

export function exportTableWorker(
  data: TableData,
  options: Parameters<typeof exportTable>[1],
): Promise<Awaited<ReturnType<typeof exportTable>>> {
  return new Promise((resolve, reject) => {
    const signal = options.signal;
    if (signal?.aborted) {
      reject(new DOMException("Conversion cancelled", "AbortError"));
      return;
    }
    let worker: Worker | undefined,
      stopped = false;
    const cleanup = () => {
      stopped = true;
      worker?.terminate();
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Conversion cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "This export took too long. Choose fewer records or a smaller file.",
        ),
      );
    }, 120_000);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      worker = new Worker(
        new URL("../../workers/xml-table.worker.ts", import.meta.url),
      );
      worker.onmessage = ({ data: response }) => {
        if (stopped) return;
        cleanup();
        if (response.error) reject(new Error(response.error));
        else resolve(response.result);
      };
      worker.onerror = () => {
        if (stopped) return;
        cleanup();
        reject(
          new Error(
            "The exporter could not start. Refresh the page and try again.",
          ),
        );
      };
      const { signal: _signal, ...serializable } = options;
      worker.postMessage({ data, options: serializable });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
