const aborted = () => new DOMException("Processing cancelled", "AbortError");

export async function runQpdfWorker<T extends object>(
  file: File,
  options: Record<string, unknown> & {
    signal?: AbortSignal;
    onProgress?: (percent: number, message: string) => void;
  },
  maxSize = 50 * 1024 * 1024,
): Promise<T & { blob: Blob }> {
  if (options.signal?.aborted) throw aborted();
  if (!file.size || file.size > maxSize)
    throw new Error(`Choose a non-empty PDF up to ${maxSize / 1024 / 1024}MB.`);
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
