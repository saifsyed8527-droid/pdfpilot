import type {
  ImagePdfInput,
  ImagePdfOptions,
  ImagePdfResult,
} from "./jpg-to-pdf-engine";

export function createImagePdfWorker(
  inputs: ImagePdfInput[],
  options: ImagePdfOptions,
  progress: (n: number) => void,
  isCancelled: () => boolean,
): Promise<ImagePdfResult | null> {
  if (isCancelled()) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined,
      done = false;
    const cleanup = () => {
      done = true;
      worker?.terminate();
      clearTimeout(timer);
      clearInterval(poll);
    };
    const poll = setInterval(() => {
      if (isCancelled()) {
        cleanup();
        resolve(null);
      }
    }, 40);
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error("Conversion took too long. Choose fewer or smaller images."),
      );
    }, 180_000);
    try {
      worker = new Worker(
        new URL("../../workers/image-pdf.worker.ts", import.meta.url),
      );
      worker.onmessage = ({ data }) => {
        if (done) return;
        if (isCancelled()) {
          cleanup();
          resolve(null);
          return;
        }
        if (typeof data.progress === "number") {
          progress(data.progress);
          return;
        }
        cleanup();
        if (data.error) reject(new Error(data.error));
        else resolve(data.result);
      };
      worker.onerror = () => {
        if (done) return;
        cleanup();
        reject(
          new Error(
            "The image converter could not start. Refresh and try again.",
          ),
        );
      };
      worker.postMessage({ inputs, options });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
