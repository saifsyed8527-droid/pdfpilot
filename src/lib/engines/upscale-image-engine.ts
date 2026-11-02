import { canvasToBlob, checkImageTask, decodeToCanvas, type OutputImageFormat } from "./image-engine";
export type UpscaleFactor = 2 | 4;
export interface UpscaledImage { blob: Blob; width: number; height: number; factor: UpscaleFactor }
export function validateUpscaleSize(width: number, height: number, factor: UpscaleFactor) {
  if (![2, 4].includes(factor) || ![width, height].every(v => Number.isInteger(v) && v > 0) || width * height * factor * factor > 16_000_000 || Math.max(width, height) * factor > 8192) throw new Error("Choose an image whose enlarged result is at most 16 megapixels and 8,192 pixels per side. Try 2× or a smaller image.");
  return { width: width * factor, height: height * factor };
}
/** A single terminable worker keeps the model alive only for this batch. */
export function upscaleImages(files: File[], factor: UpscaleFactor, compatibility: boolean, signal?: AbortSignal, onProgress?: (percent: number, message: string) => void, onItem?: (index: number, image: UpscaledImage) => void): Promise<UpscaledImage[]> {
  checkImageTask(signal);
  if (!files.length || files.length > 10 || ![2, 4].includes(factor)) return Promise.reject(new Error("Choose up to 10 images and 2× or 4× enlargement."));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker("/image-upscale/worker.js", { type: "module" }); } catch { reject(new Error("Image upscaling could not start. Try a current browser.")); return; }
    let timer: ReturnType<typeof setTimeout>, index = 0, settled = false;
    const results: UpscaledImage[] = [];
    const cleanup = () => { settled = true; clearTimeout(timer); worker.terminate(); signal?.removeEventListener("abort", abort); };
    const fail = (error: Error) => { if (!settled) { cleanup(); reject(error); } };
    const abort = () => fail(new DOMException("Image upscaling cancelled.", "AbortError"));
    const heartbeat = () => { clearTimeout(timer); timer = setTimeout(() => fail(new Error("Upscaling stopped responding. Try a smaller image or compatibility mode.")), 180_000); };
    const next = () => { heartbeat(); onProgress?.(index / files.length * 100, `Preparing image ${index + 1} of ${files.length}…`); worker.postMessage({ file: files[index], factor, compatibility }); };
    worker.onmessage = ({ data }) => {
      if (settled) return;
      if (data.type === "progress") { heartbeat(); onProgress?.((index + Math.max(0, Math.min(100, data.progress)) / 100) / files.length * 100, `Image ${index + 1} of ${files.length}: ${data.message}`); }
      else if (data.type === "error") fail(new Error(data.message));
      else if (data.type === "done") {
        try {
          validateUpscaleSize(data.width / factor, data.height / factor, factor);
          if (!(data.blob instanceof Blob) || data.blob.type !== "image/png" || !data.blob.size || data.blob.size > 100 * 1024 * 1024) throw new Error("The image model returned an invalid result. Please retry.");
          const image: UpscaledImage = { blob: data.blob, width: data.width, height: data.height, factor };
          results.push(image); onItem?.(index, image); index++;
          if (index === files.length) { cleanup(); onProgress?.(100, "Your enlarged images are ready."); resolve(results); } else next();
        } catch (error) { fail(error instanceof Error ? error : new Error("Could not prepare the enlarged image.")); }
      }
    };
    worker.onerror = () => fail(new Error("This image could not be enlarged on your device. Try compatibility mode or a smaller image."));
    signal?.addEventListener("abort", abort, { once: true }); if (signal?.aborted) abort(); else next();
  });
}
export async function encodeUpscaledImage(image: UpscaledImage, format: OutputImageFormat, quality: number, signal?: AbortSignal) {
  checkImageTask(signal);
  if (!Number.isFinite(quality) || quality < .1 || quality > 1 || !["image/png", "image/jpeg", "image/webp"].includes(format)) throw new Error("Choose a valid format and quality from 10 to 100.");
  if (format === "image/png") return image.blob;
  const decoded = await decodeToCanvas(new File([image.blob], "enlarged.png", { type: "image/png" }), signal);
  try { return await canvasToBlob(decoded.canvas, format, quality, signal); }
  finally { decoded.canvas.width = decoded.canvas.height = 0; }
}
