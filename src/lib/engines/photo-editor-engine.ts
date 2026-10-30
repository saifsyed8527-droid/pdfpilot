import { canvasToBlob, checkImageTask, decodeToCanvas, validateImageDimensions, type CropRegion, type OutputImageFormat } from "./image-engine";

export const PHOTO_FILTERS = ["none", "grayscale", "black-white", "sepia", "warm", "cool", "vintage", "invert"] as const;
export const PHOTO_STICKERS = ["😀", "😊", "😍", "😎", "🎉", "❤️", "⭐", "✅", "❌", "💬", "💡", "🔥", "🎵", "🌸", "☀️", "☁️", "🌈", "✈️", "🚀", "🏠", "🌳", "🎁", "📍", "👍"] as const;
export interface PhotoSettings {
  crop: CropRegion;
  width: number; height: number;
  rotate: 0 | 90 | 180 | 270;
  flipHorizontal: boolean; flipVertical: boolean;
  brightness: number; contrast: number; saturation: number;
  filter: typeof PHOTO_FILTERS[number];
  background: string;
  corners: number;
  frame: "none" | "solid" | "double" | "polaroid";
  frameWidth: number;
  frameColor: string;
  captionSpace?: number;
  captionBackground?: string;
}
export interface PhotoLayer {
  id: string;
  kind: "text" | "shape" | "sticker" | "image" | "draw";
  name: string;
  x: number; y: number; width: number; height: number;
  rotation: number; opacity: number;
  hidden: boolean; locked: boolean;
  color: string; fill: string;
  lineWidth: number;
  text: string;
  font: "sans-serif" | "serif" | "monospace" | "cursive" | "impact";
  outlineColor?: string;
  outlineWidth?: number;
  fontSize: number;
  bold: boolean; italic: boolean; underline: boolean;
  align: "left" | "center" | "right";
  shape: "rectangle" | "ellipse" | "triangle" | "star" | "line" | "arrow";
  points?: { x: number; y: number }[];
  image?: File;
}
export interface PhotoState { settings: PhotoSettings; layers: PhotoLayer[] }
export function initialPhotoState(width: number, height: number): PhotoState {
  validateImageDimensions(width, height);
  if (width * height > 20_000_000) throw new Error("Choose a photo below 20 megapixels.");
  return { settings: { crop: { x: 0, y: 0, width, height }, width, height, rotate: 0, flipHorizontal: false, flipVertical: false, brightness: 0, contrast: 0, saturation: 0, filter: "none", background: "transparent", corners: 0, frame: "none", frameWidth: .03, frameColor: "#ffffff" }, layers: [] };
}
export function newPhotoLayer(kind: PhotoLayer["kind"], id: string): PhotoLayer {
  return { id, kind, name: kind[0].toUpperCase() + kind.slice(1), x: .25, y: .35, width: .5, height: .3, rotation: 0, opacity: 1, hidden: false, locked: false, color: "#111827", fill: kind === "shape" ? "#f97316" : "transparent", lineWidth: .006, text: kind === "sticker" ? "😀" : "Your text", font: "sans-serif", fontSize: .08, bold: true, italic: false, underline: false, align: "center", shape: "rectangle" };
}
const colorValid = (color: string, transparent = false) => (transparent && color === "transparent") || /^#[0-9a-f]{6}$/i.test(color);
export function validatePhotoState(state: PhotoState, sourceWidth: number, sourceHeight: number) {
  const s = state.settings, c = s.crop;
  validateImageDimensions(s.width, s.height);
  if (s.width * s.height > 20_000_000 || sourceWidth * sourceHeight > 20_000_000) throw new Error("Photo editing is limited to 20 megapixels.");
  if (![c.x, c.y, c.width, c.height].every(Number.isInteger) || c.x < 0 || c.y < 0 || c.width < 1 || c.height < 1 || c.x + c.width > sourceWidth || c.y + c.height > sourceHeight) throw new Error("Keep the crop inside the original photo.");
  if (![0, 90, 180, 270].includes(s.rotate) || ![s.brightness, s.contrast, s.saturation].every(v => Number.isFinite(v) && v >= -100 && v <= 100) || !PHOTO_FILTERS.includes(s.filter)) throw new Error("Choose valid photo adjustments.");
  if (!colorValid(s.background, true) || !colorValid(s.frameColor) || !Number.isFinite(s.corners) || s.corners < 0 || s.corners > .5 || !Number.isFinite(s.frameWidth) || s.frameWidth < 0 || s.frameWidth > .25 || !["none", "solid", "double", "polaroid"].includes(s.frame)) throw new Error("Choose valid background, corner and frame settings.");
  if (!Number.isFinite(s.captionSpace ?? 0) || (s.captionSpace ?? 0) < 0 || (s.captionSpace ?? 0) > .3 || !colorValid(s.captionBackground ?? "#ffffff")) throw new Error("Choose valid caption spacing and color.");
  if (state.layers.length > 60) throw new Error("Use up to 60 layers. Delete unused layers before adding more.");
  let points = 0;
  for (const l of state.layers) {
    if (!["text", "shape", "sticker", "image", "draw"].includes(l.kind) || ![l.x, l.y, l.width, l.height, l.rotation, l.opacity, l.lineWidth, l.fontSize].every(Number.isFinite) || l.x < -1 || l.y < -1 || l.x > 1 || l.y > 1 || l.width <= 0 || l.height <= 0 || l.width > 2 || l.height > 2 || Math.abs(l.rotation) > 360 || l.opacity < 0 || l.opacity > 1 || l.lineWidth <= 0 || l.lineWidth > .2 || l.fontSize <= 0 || l.fontSize > 1 || !colorValid(l.color) || !colorValid(l.fill, true)) throw new Error("Check the selected layer's size, position and style.");
    if (!colorValid(l.outlineColor ?? "#000000") || !Number.isFinite(l.outlineWidth ?? 0) || (l.outlineWidth ?? 0) < 0 || (l.outlineWidth ?? 0) > .05) throw new Error("Choose a valid text outline.");
    if (l.text.length > 2000 || l.text.split(/\r?\n/).length > 30) throw new Error("Use up to 2,000 characters and 30 lines per text layer.");
    if (l.kind === "sticker" && !PHOTO_STICKERS.includes(l.text as typeof PHOTO_STICKERS[number])) throw new Error("Choose a sticker from the available set.");
    if (l.kind === "draw") {
      if (!l.points?.length || l.points.some(p => ![p.x, p.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1))) throw new Error("Invalid drawing points.");
      points += l.points.length; if (l.points.length > 4000 || points > 20000) throw new Error("This drawing is too detailed. Use shorter strokes or fewer drawing layers.");
    }
  }
}

function shapePath(ctx: CanvasRenderingContext2D, type: PhotoLayer["shape"], width: number, height: number) {
  const x = -width / 2, y = -height / 2; ctx.beginPath();
  if (type === "ellipse") ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
  else if (type === "triangle") { ctx.moveTo(0, y); ctx.lineTo(width / 2, height / 2); ctx.lineTo(x, height / 2); ctx.closePath(); }
  else if (type === "star") {
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? .42 : 1, px = Math.cos(a) * width / 2 * radius, py = Math.sin(a) * height / 2 * radius; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath();
  } else if (type === "line") { ctx.moveTo(x, 0); ctx.lineTo(width / 2, 0); }
  else if (type === "arrow") { ctx.moveTo(x, -height * .15); ctx.lineTo(width * .1, -height * .15); ctx.lineTo(width * .1, y); ctx.lineTo(width / 2, 0); ctx.lineTo(width * .1, height / 2); ctx.lineTo(width * .1, height * .15); ctx.lineTo(x, height * .15); ctx.closePath(); }
  else ctx.rect(x, y, width, height);
}
function wrappedLines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const result: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) { result.push(line); line = word; } else line = next;
    }
    result.push(line);
  }
  return result;
}
function drawPhotoText(ctx: CanvasRenderingContext2D, layer: PhotoLayer, width: number, height: number, shorter: number) {
  const family = layer.font === "impact" ? "Impact, Arial Black, sans-serif" : ["sans-serif", "serif", "monospace", "cursive"].includes(layer.font) ? layer.font : "sans-serif";
  const inset = (layer.outlineWidth ?? 0) > 0 ? (layer.outlineWidth ?? 0) * shorter / 2 + 1 : 0, textWidth = Math.max(1, width - inset * 2), textHeight = Math.max(1, height - inset * 2);
  let size = shorter * layer.fontSize;
  const font = () => `${layer.italic ? "italic " : ""}${layer.bold ? "bold " : ""}${Math.max(1, size)}px ${family}`;
  ctx.font = font(); let lines = wrappedLines(ctx, layer.text, textWidth);
  for (let i = 0; i < 3; i++) {
    const widest = Math.max(1, ...lines.map(line => ctx.measureText(line).width));
    const scale = Math.min(1, textWidth / widest, textHeight / (Math.max(1, lines.length) * size * 1.3));
    size *= scale; ctx.font = font(); lines = wrappedLines(ctx, layer.text, textWidth);
  }
  ctx.fillStyle = layer.color; ctx.textAlign = layer.align; ctx.textBaseline = "middle";
  const x = layer.align === "left" ? -width / 2 + inset : layer.align === "right" ? width / 2 - inset : 0;
  ctx.save(); ctx.beginPath(); ctx.rect(-width / 2, -height / 2, width, height); ctx.clip();
  lines.forEach((line, index) => {
    ctx.direction = /[\u0590-\u08ff]/.test(line) ? "rtl" : "ltr";
    const y = -height / 2 + inset + size * 1.3 * (index + .5);
    if ((layer.outlineWidth ?? 0) > 0) { ctx.strokeStyle = layer.outlineColor ?? "#000000"; ctx.lineWidth = Math.max(.5, (layer.outlineWidth ?? 0) * shorter); ctx.strokeText(line, x, y); }
    ctx.fillText(line, x, y);
    if (layer.underline) { const length = ctx.measureText(line).width; ctx.fillRect(x - (layer.align === "center" ? length / 2 : layer.align === "right" ? length : 0), y + size * .48, length, Math.max(1, size * .05)); }
  }); ctx.restore();
}
async function adjustPixels(ctx: CanvasRenderingContext2D, width: number, height: number, settings: PhotoSettings, signal?: AbortSignal) {
  const s = settings;
  if (!s.brightness && !s.contrast && !s.saturation && s.filter === "none") return;
  const image = ctx.getImageData(0, 0, width, height), data = image.data;
  const contrast = (259 * (s.contrast + 255)) / (255 * (259 - s.contrast));
  const saturation = 1 + s.saturation / 100;
  for (let offset = 0; offset < data.length; offset += 262144) {
    checkImageTask(signal);
    const end = Math.min(data.length, offset + 262144);
    for (let i = offset; i < end; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];
      const luma = .2126 * r + .7152 * g + .0722 * b;
      r = luma + (r - luma) * saturation; g = luma + (g - luma) * saturation; b = luma + (b - luma) * saturation;
      r = contrast * (r - 128) + 128 + s.brightness * 2.55; g = contrast * (g - 128) + 128 + s.brightness * 2.55; b = contrast * (b - 128) + 128 + s.brightness * 2.55;
      if (s.filter === "grayscale" || s.filter === "black-white") { const gray = .2126 * r + .7152 * g + .0722 * b; r = g = b = s.filter === "black-white" ? gray >= 128 ? 255 : 0 : gray; }
      else if (s.filter === "sepia" || s.filter === "vintage") { const rr = .393 * r + .769 * g + .189 * b, gg = .349 * r + .686 * g + .168 * b, bb = .272 * r + .534 * g + .131 * b; const blend = s.filter === "vintage" ? .6 : 1; r += (rr - r) * blend; g += (gg - g) * blend; b += (bb - b) * blend; }
      else if (s.filter === "warm") { r *= 1.12; b *= .88; }
      else if (s.filter === "cool") { r *= .9; b *= 1.12; }
      else if (s.filter === "invert") { r = 255 - r; g = 255 - g; b = 255 - b; }
      data[i] = r; data[i + 1] = g; data[i + 2] = b;
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  checkImageTask(signal); ctx.putImageData(image, 0, 0);
}

export async function renderPhoto(file: File, state: PhotoState, format: OutputImageFormat, quality = .92, signal?: AbortSignal, previewMaxSide?: number): Promise<Blob> {
  const source = await decodeToCanvas(file, signal), base = document.createElement("canvas"), output = document.createElement("canvas");
  try {
    validatePhotoState(state, source.width, source.height);
    if (previewMaxSide !== undefined && (!Number.isFinite(previewMaxSide) || previewMaxSide < 1 || previewMaxSide > 1200)) throw new Error("Invalid photo preview size.");
    const s = state.settings, ratio = previewMaxSide === undefined ? 1 : Math.min(1, previewMaxSide / Math.max(s.width, s.height));
    base.width = output.width = Math.max(1, Math.round(s.width * ratio)); base.height = output.height = Math.max(1, Math.round(s.height * ratio));
    const width = base.width, height = base.height, shorter = Math.min(width, height), ctx = base.getContext("2d")!, final = output.getContext("2d")!;
    const rotated = s.rotate === 90 || s.rotate === 270, c = s.crop, captionHeight = (s.captionSpace ?? 0) * height, photoHeight = height - captionHeight * 2;
    ctx.save(); ctx.translate(width / 2, height / 2); ctx.scale(width / (rotated ? c.height : c.width), photoHeight / (rotated ? c.width : c.height)); ctx.rotate(s.rotate * Math.PI / 180); ctx.scale(s.flipHorizontal ? -1 : 1, s.flipVertical ? -1 : 1);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(source.canvas, c.x, c.y, c.width, c.height, -c.width / 2, -c.height / 2, c.width, c.height); ctx.restore();
    await adjustPixels(ctx, width, height, s, signal);
    if (captionHeight > 0) { ctx.fillStyle = s.captionBackground ?? "#ffffff"; ctx.fillRect(0, 0, width, captionHeight); ctx.fillRect(0, height - captionHeight, width, captionHeight); }
    if (s.background !== "transparent") { ctx.save(); ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = s.background; ctx.fillRect(0, 0, width, height); ctx.restore(); }
    for (const l of state.layers) {
      checkImageTask(signal); if (l.hidden) continue;
      const w = l.width * width, h = l.height * height;
      ctx.save(); ctx.translate((l.x + l.width / 2) * width, (l.y + l.height / 2) * height); ctx.rotate(l.rotation * Math.PI / 180); ctx.globalAlpha = l.opacity;
      ctx.fillStyle = l.fill; ctx.strokeStyle = l.color; ctx.lineWidth = Math.max(.25, l.lineWidth * shorter); ctx.lineJoin = "round"; ctx.lineCap = "round";
      if (l.kind === "shape") { shapePath(ctx, l.shape, w, h); if (l.fill !== "transparent" && l.shape !== "line") ctx.fill(); ctx.stroke(); }
      else if (l.kind === "draw") {
        const points = l.points!; ctx.beginPath();
        points.forEach((p, index) => { const x = (p.x - .5) * w, y = (p.y - .5) * h; if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        if (points.length === 1) { ctx.fillStyle = l.color; ctx.arc((points[0].x - .5) * w, (points[0].y - .5) * h, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); } else ctx.stroke();
      } else if (l.kind === "sticker") { ctx.fillStyle = l.color; ctx.font = `${Math.min(w, h) * .82}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(l.text, 0, 0); }
      else if (l.kind === "text") { if (l.fill !== "transparent") ctx.fillRect(-w / 2, -h / 2, w, h); drawPhotoText(ctx, l, w, h, shorter); }
      else if (l.kind === "image") {
        if (!l.image || l.image.size > 5 * 1024 * 1024) throw new Error("Choose an overlay image smaller than 5MB.");
        const overlay = await decodeToCanvas(l.image, signal);
        try { if (overlay.width * overlay.height > 5_000_000) throw new Error("Use overlay images below five megapixels."); ctx.drawImage(overlay.canvas, -w / 2, -h / 2, w, h); }
        finally { overlay.canvas.width = overlay.canvas.height = 0; }
      }
      ctx.restore(); await new Promise(resolve => setTimeout(resolve, 0));
    }
    checkImageTask(signal);
    final.save(); final.beginPath(); final.roundRect(0, 0, width, height, shorter * s.corners); final.clip(); final.drawImage(base, 0, 0);
    const border = shorter * s.frameWidth;
    if (s.frame !== "none" && border > 0) {
      final.fillStyle = s.frameColor;
      if (s.frame === "polaroid") { final.fillRect(0, 0, width, border); final.fillRect(0, 0, border, height); final.fillRect(width - border, 0, border, height); final.fillRect(0, height - border * 3, width, border * 3); }
      else { final.strokeStyle = s.frameColor; final.lineWidth = s.frame === "double" ? border / 3 : border; const inset = final.lineWidth / 2; final.strokeRect(inset, inset, width - inset * 2, height - inset * 2); if (s.frame === "double") final.strokeRect(border * 1.3, border * 1.3, width - border * 2.6, height - border * 2.6); }
    }
    final.restore(); return await canvasToBlob(output, format, quality, signal);
  } finally { source.canvas.width = source.canvas.height = base.width = base.height = output.width = output.height = 0; }
}
