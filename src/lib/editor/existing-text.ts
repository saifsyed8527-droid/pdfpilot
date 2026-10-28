/**
 * Extracts existing text runs from a rendered PDF page, for Advanced
 * Edit's "click existing text to edit it" feature.
 *
 * pdfjs's `getTextContent()` gives each run's transform matrix in the
 * page's default (unrotated) PDF coordinate space - the same space
 * `page.drawText`'s `x`/`y` expect - so `xPt`/`yPt` here can be fed
 * straight back into pdf-lib at export time with no further conversion.
 * The canvas-pixel bounding box (`xPx`/`yPx`/`widthPx`/`heightPx`) is
 * derived from `Util.transform(viewport.transform, item.transform)`, the
 * same matrix-combination pdfjs's own text layer uses to position its
 * selectable spans, so the clickable overlay lines up with the rendered
 * glyphs at whatever scale the page canvas was rendered at.
 *
 * The click target uses approximate ascent/descent ratios. Background
 * sampling supports simple page backgrounds; textured backgrounds can
 * require manual adjustment after a scanned-text replacement.
 */

export interface ExtractedTextRun {
  id: string;
  str: string;
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  fontSizePt: number;
  coverColor: string;
  rotation: number;
  textAngle: number;
  source?: "native" | "ocr";
}

const ASCENT_RATIO = 0.85;
const DESCENT_RATIO = 0.25;

function sampleCoverColor(canvas: HTMLCanvasElement, xPx: number, yPx: number, widthPx: number, heightPx: number): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#ffffff";
  const x = Math.max(0, Math.min(canvas.width - 1, Math.round(xPx)));
  const y = Math.max(0, Math.min(canvas.height - 1, Math.round(yPx)));
  const w = Math.max(1, Math.min(canvas.width - x, Math.round(widthPx)));
  const h = Math.max(1, Math.min(canvas.height - y, Math.round(heightPx)));
  try {
    const { data } = ctx.getImageData(x, y, w, h);
    // Most-common color wins (a simple mode) - background pixels vastly
    // outnumber the thin glyph strokes in almost every real run, so this
    // reliably picks the page background rather than the text color.
    const counts = new Map<string, number>();
    for (let i = 0; i < data.length; i += 4 * 7) {
      const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best = "255,255,255";
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        best = key;
        bestCount = count;
      }
    }
    const [r, g, b] = best.split(",").map(Number);
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return "#ffffff";
  }
}

export async function extractPageTextRuns(
  pdfjsPage: import("pdfjs-dist").PDFPageProxy,
  pdfjsLib: Awaited<ReturnType<typeof import("../pdfjs").loadPdfjs>>,
  viewport: import("pdfjs-dist").PageViewport,
  canvas: HTMLCanvasElement
): Promise<ExtractedTextRun[]> {
  const textContent = await pdfjsPage.getTextContent();
  const runs: ExtractedTextRun[] = [];
  let index = 0;

  for (const item of textContent.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    index += 1;

    const t = item.transform;
    const fontSizePt = Math.hypot(t[2], t[3]) || Math.hypot(t[0], t[1]) || 10;
    const xPt = t[4];
    const yPt = t[5];
    const widthPt = item.width || fontSizePt * item.str.length * 0.5;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdfjs-dist's Util isn't exported from the app's thin loadPdfjs() wrapper's type
    const combined = (pdfjsLib as any).Util.transform(viewport.transform, t);
    const fontSizePx = Math.hypot(combined[2], combined[3]) || fontSizePt;
    const widthPx = widthPt * (fontSizePx / fontSizePt);
    const heightPx = fontSizePx * (ASCENT_RATIO + DESCENT_RATIO);
    const angle = Math.atan2(combined[1], combined[0]);
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const topX = combined[4] + uy * fontSizePx * ASCENT_RATIO;
    const topY = combined[5] - ux * fontSizePx * ASCENT_RATIO;
    // CSS rotates around the box centre, whereas PDF text uses a baseline.
    const xPx = topX + ux * widthPx / 2 - uy * heightPx / 2 - widthPx / 2;
    const yPx = topY + uy * widthPx / 2 + ux * heightPx / 2 - heightPx / 2;
    const sampleWidth = Math.abs(ux * widthPx) + Math.abs(uy * heightPx);
    const sampleHeight = Math.abs(uy * widthPx) + Math.abs(ux * heightPx);

    runs.push({
      id: `run-${index}`,
      str: item.str,
      xPx,
      yPx,
      widthPx,
      heightPx,
      xPt,
      yPt,
      widthPt,
      heightPt: fontSizePt * (ASCENT_RATIO + DESCENT_RATIO),
      fontSizePt,
      coverColor: sampleCoverColor(canvas, xPx + widthPx / 2 - sampleWidth / 2, yPx + heightPx / 2 - sampleHeight / 2, sampleWidth, sampleHeight),
      rotation: angle * 180 / Math.PI,
      textAngle: Math.atan2(t[1], t[0]) * 180 / Math.PI,
      source: "native",
    });
  }

  return runs;
}

/** OCR is explicit and local. Group recognized words into selectable lines. */
export async function extractScannedTextRuns(
  canvas: HTMLCanvasElement,
  viewport: import("pdfjs-dist").PageViewport,
  signal: AbortSignal,
  onProgress?: (progress: number) => void
): Promise<ExtractedTextRun[]> {
  const { recognizeText } = await import("../engines/ocr-engine");
  const result = await recognizeText(canvas, onProgress, signal);
  const lines: { text: string; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (const word of result.words ?? []) {
    if (!word.text.trim()) continue;
    const { x0, y0, x1, y1 } = word.bbox;
    const last = lines.at(-1);
    if (last && x0 >= last.x0 && Math.abs((y0 + y1) / 2 - (last.y0 + last.y1) / 2) < Math.min(y1 - y0, last.y1 - last.y0) * 0.6) {
      last.text += ` ${word.text}`; last.x1 = Math.max(last.x1, x1); last.y0 = Math.min(last.y0, y0); last.y1 = Math.max(last.y1, y1);
    } else lines.push({ text: word.text, x0, y0, x1, y1 });
  }
  return lines.map((line, index) => {
    const widthPx = line.x1 - line.x0, inkHeight = line.y1 - line.y0;
    // OCR boxes contain ink, not the font's ascent/descent or line spacing.
    const fontSizePx = inkHeight / 0.8, heightPx = fontSizePx * (ASCENT_RATIO + DESCENT_RATIO);
    const yPx = line.y1 - fontSizePx * ASCENT_RATIO;
    const [xPt, yPt] = viewport.convertToPdfPoint(line.x0, line.y1);
    const [nextX, nextY] = viewport.convertToPdfPoint(line.x0 + 1, line.y1);
    return { id: `ocr-${index}`, str: line.text, xPx: line.x0, yPx, widthPx, heightPx,
      xPt, yPt, widthPt: widthPx / viewport.scale, heightPt: heightPx / viewport.scale,
      fontSizePt: fontSizePx / viewport.scale, coverColor: sampleCoverColor(canvas, line.x0, line.y0, widthPx, heightPx),
      rotation: 0, textAngle: Math.atan2(nextY - yPt, nextX - xPt) * 180 / Math.PI, source: "ocr" };
  });
}
