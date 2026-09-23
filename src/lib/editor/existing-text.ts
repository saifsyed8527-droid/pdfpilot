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
 * pdfjs's TextItem does not expose glyph ascent/descent or color, so the
 * vertical extent of each run's box and its cover-rectangle height are a
 * reasonable, disclosed approximation (typical ascent ~0.85x nominal size,
 * descent ~0.25x) rather than exact per-font metrics - see the migration
 * report for why (no client-side PDF library exposes that reliably across
 * arbitrary PDF producers).
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
    const xPx = combined[4];
    const baselineYPx = combined[5];
    const fontSizePx = Math.hypot(combined[2], combined[3]) || fontSizePt;
    const widthPx = widthPt * (fontSizePx / fontSizePt);
    const topPx = baselineYPx - fontSizePx * ASCENT_RATIO;
    const heightPx = fontSizePx * (ASCENT_RATIO + DESCENT_RATIO);

    runs.push({
      id: `run-${index}`,
      str: item.str,
      xPx,
      yPx: topPx,
      widthPx,
      heightPx,
      xPt,
      yPt,
      widthPt,
      heightPt: fontSizePt * (ASCENT_RATIO + DESCENT_RATIO),
      fontSizePt,
      coverColor: sampleCoverColor(canvas, xPx, topPx, widthPx, heightPx),
    });
  }

  return runs;
}
