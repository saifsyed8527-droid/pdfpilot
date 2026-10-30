import { canvasToBlob, checkImageTask, decodeToCanvas, type OutputImageFormat } from "./image-engine";

export interface ImageWatermarkLayer {
  id: string;
  kind: "text" | "image";
  text: string;
  image?: File;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  font: "sans-serif" | "serif" | "monospace";
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  background: string;
  opacity: number;
  rotation: number;
  tiled: boolean;
}

export async function watermarkImage(
  file: File, layers: ImageWatermarkLayer[], format: OutputImageFormat,
  quality = .92, signal?: AbortSignal, previewMaxSide?: number,
  onPosition?: (id: string, x: number, y: number) => void,
): Promise<Blob> {
  if (!layers.length || layers.length > 10) throw new Error("Add between one and ten watermarks.");
  const source = await decodeToCanvas(file, signal);
  const canvas = source.canvas;
  try {
    if (previewMaxSide !== undefined) {
      if (!Number.isFinite(previewMaxSide) || previewMaxSide < 1 || previewMaxSide > 1200) throw new Error("Invalid preview dimensions.");
      const ratio = Math.min(1, previewMaxSide / Math.max(source.width, source.height));
      if (ratio < 1) {
        const small = document.createElement("canvas");
        small.width = Math.max(1, Math.round(source.width * ratio)); small.height = Math.max(1, Math.round(source.height * ratio));
        small.getContext("2d")!.drawImage(canvas, 0, 0, small.width, small.height);
        canvas.width = small.width; canvas.height = small.height;
        canvas.getContext("2d")!.drawImage(small, 0, 0); small.width = small.height = 0;
      }
    }
    const ctx = canvas.getContext("2d")!, width = canvas.width, height = canvas.height;
    for (const layer of layers) {
      checkImageTask(signal);
      if (![layer.x, layer.y, layer.width, layer.fontSize, layer.opacity, layer.rotation].every(Number.isFinite) ||
          layer.x < 0 || layer.x > 1 || layer.y < 0 || layer.y > 1 || layer.width <= 0 || layer.width > 1 ||
          layer.fontSize <= 0 || layer.fontSize > .5 || layer.opacity < 0 || layer.opacity > 1 || Math.abs(layer.rotation) > 360) throw new Error("Choose valid watermark size, position and opacity.");
      if (!/^#[0-9a-f]{6}$/i.test(layer.color) || (layer.background !== "transparent" && !/^#[0-9a-f]{6}$/i.test(layer.background))) throw new Error("Choose a valid watermark color.");
      let logo: HTMLCanvasElement | undefined;
      try {
        let markWidth = width * layer.width, markHeight = 0;
        let fontSize = Math.max(1, Math.min(width, height) * layer.fontSize);
        const lines = layer.text.split(/\r?\n/);
        if (layer.kind === "image") {
          if (!layer.image) throw new Error("Choose a logo image for this watermark.");
          if (layer.image.size > 5 * 1024 * 1024) throw new Error("Choose a watermark image smaller than 5MB.");
          logo = (await decodeToCanvas(layer.image, signal)).canvas;
          if (logo.width * logo.height > 5_000_000) throw new Error("Use a watermark image below five megapixels.");
          markHeight = markWidth * logo.height / logo.width;
          if (markHeight > height * .9) { markWidth *= height * .9 / markHeight; markHeight = height * .9; }
        } else {
          if (!layer.text.trim() || layer.text.length > 1000 || lines.length > 12) throw new Error("Enter watermark text, up to 1,000 characters and 12 lines.");
          const family = ["sans-serif", "serif", "monospace"].includes(layer.font) ? layer.font : "sans-serif";
          const font = (size: number) => `${layer.italic ? "italic " : ""}${layer.bold ? "bold " : ""}${size}px ${family}`;
          ctx.font = font(fontSize);
          const widest = Math.max(1, ...lines.map(line => ctx.measureText(line).width));
          fontSize *= Math.min(1, markWidth / widest, height * .85 / (lines.length * fontSize * 1.3));
          ctx.font = font(fontSize);
          markWidth = Math.max(1, ...lines.map(line => ctx.measureText(line).width));
          markHeight = lines.length * fontSize * 1.3;
        }
        const padding = Math.max(1, fontSize * .12), angle = layer.rotation * Math.PI / 180;
        const halfWidth = (Math.abs(Math.cos(angle)) * (markWidth + padding * 2) + Math.abs(Math.sin(angle)) * (markHeight + padding * 2)) / 2;
        const halfHeight = (Math.abs(Math.sin(angle)) * (markWidth + padding * 2) + Math.abs(Math.cos(angle)) * (markHeight + padding * 2)) / 2;
        const draw = (x: number, y: number) => {
          ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = layer.opacity;
          if (layer.background !== "transparent") { ctx.fillStyle = layer.background; ctx.fillRect(-markWidth / 2 - padding, -markHeight / 2 - padding, markWidth + padding * 2, markHeight + padding * 2); }
          if (logo) ctx.drawImage(logo, -markWidth / 2, -markHeight / 2, markWidth, markHeight);
          else {
            ctx.fillStyle = layer.color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            lines.forEach((line, index) => {
              ctx.direction = /[\u0590-\u08ff]/.test(line) ? "rtl" : "ltr";
              const y = -markHeight / 2 + fontSize * 1.3 * (index + .5);
              ctx.fillText(line, 0, y);
              if (layer.underline) { const lineWidth = ctx.measureText(line).width; ctx.fillRect(-lineWidth / 2, y + fontSize * .48, lineWidth, Math.max(1, fontSize * .05)); }
            });
          }
          ctx.restore();
        };
        if (layer.tiled) {
          const gap = Math.max(16, Math.min(width, height) * .08), stepX = Math.max(halfWidth * 2 + gap, width / 25), stepY = Math.max(halfHeight * 2 + gap, height / 25);
          for (let y = 0, row = 0; y < height + stepY; y += stepY, row++) {
            for (let x = row % 2 ? -stepX / 2 : 0; x < width + stepX; x += stepX) draw(x, y);
          }
        } else {
          const fit = (position: number, extent: number, limit: number) => extent * 2 >= limit ? limit / 2 : Math.max(extent, Math.min(limit - extent, position * limit));
          const x = fit(layer.x, halfWidth, width), y = fit(layer.y, halfHeight, height);
          onPosition?.(layer.id, x / width, y / height);
          draw(x, y);
        }
      } finally { if (logo) logo.width = logo.height = 0; }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return await canvasToBlob(canvas, format, quality, signal);
  } finally { canvas.width = canvas.height = 0; }
}
