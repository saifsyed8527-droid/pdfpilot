import { canvasToBlob, checkImageTask, decodeToCanvas, type OutputImageFormat } from "./image-engine";

export interface PrivacyArea { id: string; x: number; y: number; width: number; height: number; enabled: boolean; origin: "manual" | "detected"; score?: number }
export interface PrivacyOptions { effect: "blur" | "pixelate" | "solid"; shape: "rectangle" | "ellipse"; strength: number; color: string }
export interface FaceBox { x: number; y: number; width: number; height: number; score: number }
export const initialPrivacyOptions: PrivacyOptions = { effect: "blur", shape: "rectangle", strength: 70, color: "#111827" };
export function faceBoxToArea(box: FaceBox, id: string): PrivacyArea | null {
  if (![box.x, box.y, box.width, box.height, box.score].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || box.score < 0 || box.score > 1) return null;
  const left = Math.max(0, box.x - box.width * .18), top = Math.max(0, box.y - box.height * .25), right = Math.min(1, box.x + box.width * 1.18), bottom = Math.min(1, box.y + box.height * 1.18);
  if (right <= left || bottom <= top) return null;
  return { id, x: left, y: top, width: right - left, height: bottom - top, enabled: true, origin: "detected", score: box.score };
}
export function areaOverlap(a: PrivacyArea, b: PrivacyArea) {
  const intersection = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return intersection / Math.max(.00000001, a.width * a.height + b.width * b.height - intersection);
}
export function detectFaceAreas(files: File[], confidence: .3 | .5 | .75, signal?: AbortSignal, progress?: (percent: number) => void): Promise<FaceBox[][]> {
  checkImageTask(signal);
  if (!files.length || files.length > 20 || ![.3, .5, .75].includes(confidence)) return Promise.reject(new Error("Choose up to 20 images and a valid sensitivity."));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker("/face-detection/worker.js"); } catch { reject(new Error("Automatic detection is unavailable in this browser. Add areas manually.")); return; }
    const cleanup = () => { worker.terminate(); signal?.removeEventListener("abort", abort); clearTimeout(timeout); };
    const abort = () => { cleanup(); reject(new Error("Image processing cancelled.")); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error("Detection took too long. Retry with fewer images, or add areas manually.")); }, 120000);
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = event => {
      if (event.data.type === "progress") progress?.(event.data.completed / event.data.total * 100);
      else if (event.data.type === "done") { cleanup(); resolve(event.data.results); }
      else if (event.data.type === "error") { cleanup(); reject(new Error(event.data.message)); }
    };
    worker.onerror = () => { cleanup(); reject(new Error("Could not start face detection. Retry or add areas manually.")); };
    worker.postMessage({ files, confidence });
  });
}

export function validatePrivacyAreas(areas: PrivacyArea[], options: PrivacyOptions) {
  if (areas.length > 100 || !["blur", "pixelate", "solid"].includes(options.effect) || !["rectangle", "ellipse"].includes(options.shape) || !Number.isFinite(options.strength) || options.strength < 10 || options.strength > 100 || !/^#[0-9a-f]{6}$/i.test(options.color)) throw new Error("Use valid protection settings and up to 100 areas per image.");
  for (const a of areas) if (![a.x, a.y, a.width, a.height].every(Number.isFinite) || a.x < 0 || a.y < 0 || a.width <= 0 || a.height <= 0 || a.x + a.width > 1.000001 || a.y + a.height > 1.000001) throw new Error("Keep each protection area inside the image.");
}
export async function renderPrivateImage(file: File, areas: PrivacyArea[], options: PrivacyOptions, format: OutputImageFormat = "image/png", quality = .92, signal?: AbortSignal, previewMaxSide?: number): Promise<Blob> {
  validatePrivacyAreas(areas, options); checkImageTask(signal);
  if (previewMaxSide !== undefined && (!Number.isFinite(previewMaxSide) || previewMaxSide < 1 || previewMaxSide > 1200)) throw new Error("Invalid privacy preview size.");
  const source = await decodeToCanvas(file, signal), result = document.createElement("canvas"), region = document.createElement("canvas"), small = document.createElement("canvas");
  try {
    if (source.width * source.height > 20_000_000) throw new Error("Use images below 20 megapixels.");
    const ratio = previewMaxSide ? Math.min(1, previewMaxSide / Math.max(source.width, source.height)) : 1;
    result.width = Math.max(1, Math.round(source.width * ratio)); result.height = Math.max(1, Math.round(source.height * ratio));
    const ctx = result.getContext("2d")!, regionCtx = region.getContext("2d")!, smallCtx = small.getContext("2d")!;
    ctx.drawImage(source.canvas, 0, 0, result.width, result.height);
    for (const a of areas.filter(area => area.enabled)) {
      checkImageTask(signal);
      const x = Math.floor(a.x * result.width + 1e-7), y = Math.floor(a.y * result.height + 1e-7), width = Math.min(result.width - x, Math.ceil((a.x + a.width) * result.width - 1e-7) - x), height = Math.min(result.height - y, Math.ceil((a.y + a.height) * result.height - 1e-7) - y);
      if (width < 1 || height < 1) continue;
      ctx.save(); ctx.beginPath(); if (options.shape === "ellipse") ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2); else ctx.rect(x, y, width, height); ctx.clip();
      if (options.effect === "solid") { ctx.fillStyle = options.color; ctx.fillRect(x, y, width, height); }
      else {
        const regionScale = Math.min(1, 512 / Math.max(width, height));
        region.width = Math.max(1, Math.round(width * regionScale)); region.height = Math.max(1, Math.round(height * regionScale));
        const radius = Math.max(1, Math.round(Math.min(region.width, region.height) * options.strength / 100 * .3));
        regionCtx.fillStyle = "#ffffff"; regionCtx.fillRect(0, 0, region.width, region.height);
        regionCtx.drawImage(source.canvas, x / ratio, y / ratio, width / ratio, height / ratio, 0, 0, region.width, region.height);
        // Opaque masks prevent transparent samples from exposing unprocessed pixels underneath.
        ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, width, height);
        if (options.effect === "pixelate") {
          small.width = Math.max(1, Math.ceil(region.width / radius)); small.height = Math.max(1, Math.ceil(region.height / radius)); smallCtx.imageSmoothingEnabled = true; smallCtx.drawImage(region, 0, 0, small.width, small.height); ctx.imageSmoothingEnabled = false; ctx.drawImage(small, x, y, width, height);
        } else {
          if (!("filter" in regionCtx)) throw new Error("Soft blur is unavailable in this browser. Choose pixelate or solid cover.");
          // Blur a bounded intermediate canvas, so a large face cannot allocate an unbounded padded surface.
          small.width = region.width + radius * 6; small.height = region.height + radius * 6; smallCtx.imageSmoothingEnabled = true;
          smallCtx.drawImage(region, 0, 0, small.width, small.height); smallCtx.drawImage(region, radius * 3, radius * 3);
          regionCtx.filter = `blur(${radius}px)`; regionCtx.drawImage(small, -radius * 3, -radius * 3); regionCtx.filter = "none";
          ctx.drawImage(region, x, y, width, height);
        }
      }
      ctx.restore(); await new Promise(resolve => setTimeout(resolve, 0));
    }
    return await canvasToBlob(result, format, quality, signal);
  } finally { source.canvas.width = source.canvas.height = result.width = result.height = region.width = region.height = small.width = small.height = 0; }
}
