import { validateGifOptions, type GifOptions } from "./image-gif-core";
export type { GifOptions } from "./image-gif-core";

export function createImageGif(files: File[], options: GifOptions, signal?: AbortSignal, progress?: (value: number) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    validateGifOptions(options, files.length);
    if (signal?.aborted) { reject(new DOMException("GIF creation cancelled.", "AbortError")); return; }
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") { reject(new Error("This browser cannot create GIFs. Use a current browser, or select PNG, JPG or WEBP.")); return; }
    const worker = new Worker(new URL("../../workers/image-gif.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => { signal?.removeEventListener("abort", abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(new DOMException("GIF creation cancelled.", "AbortError")); };
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ progress?: number; bytes?: ArrayBuffer; error?: string }>) => {
      if (event.data.error) { cleanup(); reject(new Error(event.data.error)); }
      else if (event.data.bytes) { cleanup(); resolve(new Blob([event.data.bytes], { type: "image/gif" })); }
      else if (event.data.progress !== undefined) progress?.(event.data.progress);
    };
    worker.onerror = () => { cleanup(); reject(new Error("GIF creation stopped. Try fewer images or smaller dimensions.")); };
    try { worker.postMessage({ files, options }); } catch (error) { cleanup(); reject(error); }
  });
}
