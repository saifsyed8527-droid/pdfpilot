import { canvasToBlob, checkImageTask, decodeToCanvas, type OutputImageFormat } from "./image-engine";

export type BackgroundMode = "fast" | "detailed";
export interface SubjectMask { width: number; height: number; alpha: Uint8ClampedArray; mode: BackgroundMode }
export interface MaskStroke { mode: "erase" | "restore"; diameter: number; points: { x: number; y: number }[] }
export interface CutoutOptions { background: "transparent" | string; feather: number }
export const initialCutoutOptions: CutoutOptions = { background: "transparent", feather: 0 };

export function validateSubjectMask(mask: SubjectMask) {
  if (![mask.width, mask.height].every(value => Number.isInteger(value) && value > 0 && value <= 2048) || mask.width * mask.height > 4_000_000 || !(mask.alpha instanceof Uint8ClampedArray) || mask.alpha.length !== mask.width * mask.height) throw new Error("The cutout mask is invalid. Remove the background again.");
}

/** One worker/model per batch. Terminating it also cancels model downloads and inference. */
export function removeImageBackgrounds(files: File[], mode: BackgroundMode, signal?: AbortSignal, onProgress?: (percent: number, message: string) => void, onItem?: (index: number, mask: SubjectMask) => void): Promise<SubjectMask[]> {
  checkImageTask(signal);
  if (!files.length || files.length > 10 || !["fast", "detailed"].includes(mode)) return Promise.reject(new Error("Choose up to 10 images and a valid processing mode."));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker("/background-removal/worker.js", { type: "module" }); } catch { reject(new Error("Background removal could not start. Try a current browser.")); return; }
    let timer: ReturnType<typeof setTimeout>, index = 0, settled = false;
    const results: SubjectMask[] = [];
    const cleanup = () => { settled = true; worker.terminate(); clearTimeout(timer); signal?.removeEventListener("abort", abort); };
    const fail = (error: Error) => { if (!settled) { cleanup(); reject(error); } };
    const abort = () => fail(new DOMException("Background removal cancelled.", "AbortError"));
    const next = () => {
      clearTimeout(timer);
      timer = setTimeout(() => fail(new Error("Background removal took too long. Choose Fast mode, fewer images or retry on a faster connection.")), 180_000);
      onProgress?.(index / files.length * 100, `Preparing image ${index + 1} of ${files.length}…`);
      worker.postMessage({ file: files[index], mode });
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (settled) return;
      if (data.type === "progress") onProgress?.((index + Math.max(0, Math.min(100, data.progress)) / 100) / files.length * 100, `Image ${index + 1} of ${files.length}: ${data.message}`);
      else if (data.type === "error") fail(new Error(data.message));
      else if (data.type === "done") {
        try {
          const mask: SubjectMask = { width: data.width, height: data.height, alpha: data.mask, mode };
          validateSubjectMask(mask); results.push(mask); onItem?.(index, mask); index++;
          if (index === files.length) { cleanup(); onProgress?.(100, "Your cutouts are ready."); resolve(results); } else next();
        } catch (error) { fail(error instanceof Error ? error : new Error("Could not prepare the cutout.")); }
      }
    };
    worker.onerror = () => fail(new Error("The image model could not run in this browser. Choose Fast mode and retry."));
    if (signal?.aborted) abort(); else next();
  });
}

export function validateCutoutOptions(strokes: MaskStroke[], options: CutoutOptions) {
  if (options.background !== "transparent" && !/^#[0-9a-f]{6}$/i.test(options.background) || !Number.isFinite(options.feather) || options.feather < 0 || options.feather > 4) throw new Error("Choose a valid background color and edge softness from 0 to 4 pixels.");
  if (strokes.length > 200 || strokes.reduce((sum, stroke) => sum + stroke.points.length, 0) > 20000) throw new Error("Use up to 200 brush strokes and 20,000 points per image.");
  for (const stroke of strokes) if (!["erase", "restore"].includes(stroke.mode) || !Number.isFinite(stroke.diameter) || stroke.diameter < .001 || stroke.diameter > .5 || !stroke.points.length || stroke.points.some(p => ![p.x, p.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1))) throw new Error("Keep brush strokes inside the image and use a valid brush size.");
}

export async function renderCutout(file: File, mask: SubjectMask, strokes: MaskStroke[], options: CutoutOptions, format: OutputImageFormat = "image/png", signal?: AbortSignal, maxSide?: number): Promise<Blob> {
  validateSubjectMask(mask); validateCutoutOptions(strokes, options); checkImageTask(signal);
  if (maxSide !== undefined && (!Number.isFinite(maxSide) || maxSide < 1 || maxSide > 1200)) throw new Error("Invalid preview size.");
  const source = await decodeToCanvas(file, signal);
  const result = document.createElement("canvas"), matte = document.createElement("canvas"), raw = document.createElement("canvas");
  try {
    if (source.width * source.height > 20_000_000) throw new Error("Use images below 20 megapixels.");
    const scale = maxSide ? Math.min(1, maxSide / Math.max(source.width, source.height)) : 1;
    result.width = matte.width = Math.max(1, Math.round(source.width * scale)); result.height = matte.height = Math.max(1, Math.round(source.height * scale));
    raw.width = mask.width; raw.height = mask.height;
    const rawContext = raw.getContext("2d")!, alpha = rawContext.createImageData(mask.width, mask.height);
    for (let i = 0; i < mask.alpha.length; i++) { const p = i * 4; alpha.data[p] = alpha.data[p + 1] = alpha.data[p + 2] = 255; alpha.data[p + 3] = mask.alpha[i]; }
    rawContext.putImageData(alpha, 0, 0);
    const ctx = result.getContext("2d")!, maskContext = matte.getContext("2d")!;
    maskContext.imageSmoothingEnabled = true; maskContext.imageSmoothingQuality = "high"; maskContext.drawImage(raw, 0, 0, matte.width, matte.height);
    for (const stroke of strokes) {
      checkImageTask(signal);
      maskContext.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";
      maskContext.strokeStyle = maskContext.fillStyle = "#ffffff"; maskContext.lineCap = maskContext.lineJoin = "round";
      maskContext.lineWidth = stroke.diameter * Math.min(matte.width, matte.height);
      maskContext.beginPath(); const first = stroke.points[0];
      if (stroke.points.length === 1) { maskContext.arc(first.x * matte.width, first.y * matte.height, maskContext.lineWidth / 2, 0, Math.PI * 2); maskContext.fill(); }
      else { maskContext.moveTo(first.x * matte.width, first.y * matte.height); for (const p of stroke.points.slice(1)) maskContext.lineTo(p.x * matte.width, p.y * matte.height); maskContext.stroke(); }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    ctx.drawImage(source.canvas, 0, 0, result.width, result.height); ctx.globalCompositeOperation = "destination-in";
    if (options.feather > 0) {
      if (!("filter" in ctx)) throw new Error("Edge softness is unavailable in this browser. Choose 0 pixels.");
      ctx.filter = `blur(${options.feather * scale}px)`;
    }
    ctx.drawImage(matte, 0, 0); ctx.filter = "none"; ctx.globalCompositeOperation = "source-over";
    if (options.background !== "transparent") { ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = options.background; ctx.fillRect(0, 0, result.width, result.height); ctx.globalCompositeOperation = "source-over"; }
    const blob = await canvasToBlob(result, format, .94, signal);
    if (blob.size > 100 * 1024 * 1024) throw new Error("The cutout exceeds 100MB. Choose WEBP or a smaller source image.");
    return blob;
  } finally { source.canvas.width = source.canvas.height = result.width = result.height = matte.width = matte.height = raw.width = raw.height = 0; }
}

export async function createCutoutZip(entries: { name: string; blob: Blob }[], signal?: AbortSignal): Promise<Blob> {
  checkImageTask(signal);
  if (!entries.length || entries.length > 10 || entries.reduce((sum, entry) => sum + entry.blob.size, 0) > 200 * 1024 * 1024) throw new Error("Use up to 10 results and 200MB combined.");
  const files: Record<string, Uint8Array> = Object.create(null);
  for (const [index, entry] of entries.entries()) { checkImageTask(signal); files[`${index + 1}_${entry.name.replace(/[\\/\u0000-\u001f]/g, "_")}`] = new Uint8Array(await entry.blob.arrayBuffer()); }
  const { zip } = await import("fflate"); checkImageTask(signal);
  return new Promise((resolve, reject) => {
    const abort = () => { terminate(); reject(new DOMException("Export cancelled.", "AbortError")); };
    const terminate = zip(files, { level: 0 }, (error, bytes) => { signal?.removeEventListener("abort", abort); if (signal?.aborted) return; if (error) reject(new Error("Could not prepare the ZIP. Try fewer images.")); else resolve(new Blob([new Uint8Array(bytes).buffer], { type: "application/zip" })); });
    signal?.addEventListener("abort", abort, { once: true }); if (signal?.aborted) abort();
  });
}
