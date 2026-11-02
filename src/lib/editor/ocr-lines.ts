import { normalizeOcrText } from "../engines/ocr-options";
import type { OcrResult } from "../engines/ocr-engine";

export interface TextRegion { xPx: number; yPx: number; widthPx: number; heightPx: number; rotation: number }
export interface OcrLine { text: string; x0: number; y0: number; x1: number; y1: number; id: string }

/** The word centre is tested in the source run's own rotated coordinates.
 * This also excludes inaccurate OCR transcriptions of already editable text. */
function covered(x: number, y: number, region: TextRegion) {
  const dx = x - region.xPx - region.widthPx / 2, dy = y - region.yPx - region.heightPx / 2;
  const angle = region.rotation * Math.PI / 180;
  return Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle)) <= region.widthPx / 2 + 2
    && Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)) <= region.heightPx / 2 + 2;
}

export function groupEditorOcrLines(words: NonNullable<OcrResult["words"]>, languages: readonly string[], width: number, height: number, exclude: readonly TextRegion[] = []): OcrLine[] {
  if (words.length > 50_000 || exclude.length > 20_000) throw new Error("This page has too many text objects. Try a simpler page.");
  // Spatial buckets keep mixed native/scanned pages bounded even when each
  // native letter is a separate PDF object. Only candidates near a word matter.
  const buckets = new Map<string, TextRegion[]>(), large: TextRegion[] = [];
  for (const region of exclude) {
    const angle = region.rotation * Math.PI / 180;
    const w = Math.abs(Math.cos(angle) * region.widthPx) + Math.abs(Math.sin(angle) * region.heightPx) + 4;
    const h = Math.abs(Math.sin(angle) * region.widthPx) + Math.abs(Math.cos(angle) * region.heightPx) + 4;
    const cx = region.xPx + region.widthPx / 2, cy = region.yPx + region.heightPx / 2;
    const left = Math.floor((cx - w / 2) / 64), right = Math.floor((cx + w / 2) / 64), top = Math.floor((cy - h / 2) / 64), bottom = Math.floor((cy + h / 2) / 64);
    if (![left, right, top, bottom].every(Number.isFinite)) continue;
    if ((right - left + 1) * (bottom - top + 1) > 256) { large.push(region); continue; }
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const key = `${x},${y}`, list = buckets.get(key) ?? []; list.push(region); buckets.set(key, list);
    }
  }
  const groups = new Map<string, OcrLine>(), segments = new Map<number, number>();
  let characters = 0;
  for (const [order, word] of words.entries()) {
    const text = word.text.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    const box = word.bbox;
    if (!text || ![box.x0, box.y0, box.x1, box.y1].every(Number.isFinite)) continue;
    const x0 = Math.max(0, box.x0), y0 = Math.max(0, box.y0), x1 = Math.min(width, box.x1), y1 = Math.min(height, box.y1);
    if (x1 <= x0 || y1 <= y0) continue;
    characters += text.length;
    if (characters > 2_000_000) throw new Error("This page contains too much recognized text.");
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const lineId = word.line ?? order;
    if ([...(buckets.get(`${Math.floor(cx / 64)},${Math.floor(cy / 64)}`) ?? []), ...large].some(region => covered(cx, cy, region))) {
      // Do not draw a replacement rectangle across a native word between two
      // scanned fragments of the same line.
      segments.set(lineId, (segments.get(lineId) ?? 0) + 1); continue;
    }
    // Tesseract's logical order and line IDs work for RTL and columns. Sorting
    // left-to-right or merging by y alone reverses Arabic and joins columns.
    const key = `${lineId}:${segments.get(lineId) ?? 0}`, line = groups.get(key);
    if (line) { line.text += ` ${text}`; line.x0 = Math.min(line.x0, x0); line.y0 = Math.min(line.y0, y0); line.x1 = Math.max(line.x1, x1); line.y1 = Math.max(line.y1, y1); }
    else groups.set(key, { text, x0, y0, x1, y1, id: "" });
  }
  return [...groups.values()].map(line => {
    line.text = normalizeOcrText(line.text, languages);
    const source = `${line.x0},${line.y0},${line.x1},${line.y1}:${line.text}`;
    let hash = 2166136261;
    for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
    return { ...line, id: `ocr-${(hash >>> 0).toString(36)}-${line.x0}-${line.y0}` };
  });
}
