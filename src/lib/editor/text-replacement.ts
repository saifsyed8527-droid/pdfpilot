import type { PDFDocument, PDFFont } from "pdf-lib";
import type { ExistingTextEditObject, PagesObjects } from "./types";
import { hasExistingTextChanges, hexToRgb01, rotatePoint } from "./types";
import { removeIndependentPageText } from "../engines/pdf-content-text";
import { loadUnicodeFonts, patchToUnicodeCmaps, resolveFont, trackDrawnText, type UnicodeFontSet } from "../engines/unicode-fonts";

/** Replace source text, never leave it searchable underneath a cover. */
export async function prepareTextReplacements(pdf: PDFDocument, file: File, objects: PagesObjects, changedIds?: ReadonlySet<string>, isCancelled?: () => boolean): Promise<number[]> {
  const flattened: number[] = [];
  let loading: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
  let original: import("pdfjs-dist").PDFDocumentProxy | undefined;
  try {
    for (const [index, all] of Object.entries(objects)) {
      if (isCancelled?.()) throw new Error("Processing cancelled.");
      const edits = all.filter((obj): obj is ExistingTextEditObject => obj.type === "existing-text-edit" && (hasExistingTextChanges(obj) || !!changedIds?.has(obj.id)));
      if (!edits.length) continue;
      const page = pdf.getPage(Number(index));
      let removed = false;
      if (edits.every(edit => edit.source !== "ocr")) {
        try { removed = await removeIndependentPageText(pdf, page, edits); } catch { /* complex content uses the rendered page below */ }
      }
      if (removed) continue;

      if (!original) {
        const { loadPdfjs } = await import("../pdfjs");
        const pdfjs = await loadPdfjs();
        loading = pdfjs.getDocument({ data: await file.arrayBuffer(), cMapUrl: "/pdfjs-assets/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs-assets/standard_fonts/", wasmUrl: "/pdfjs-assets/wasm/" });
        original = await loading.promise;
      }
      const source = await original.getPage(Number(index) + 1);
      const natural = source.getViewport({ scale: 1, rotation: 0 });
      const scale = Math.min(2, Math.sqrt(16_000_000 / (natural.width * natural.height)));
      const viewport = source.getViewport({ scale, rotation: 0 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser could not prepare this page. Please try again.");
      try {
        // Interactive widgets and links stay on the page as annotations.
        // Exclude them from the image to avoid painting them twice.
        await source.render({ canvas, viewport, annotationMode: 0 }).promise;
        if (isCancelled?.()) throw new Error("Processing cancelled.");
        for (const edit of edits) {
          const angle = (edit.originalTextAngle ?? 0) * Math.PI / 180;
          const size = edit.originalFontSizePt ?? edit.fontSizePt;
          const points = [[-1, -size * 0.28], [edit.originalWidthPt + 1, -size * 0.28], [edit.originalWidthPt + 1, size * 0.87], [-1, size * 0.87]];
          ctx.fillStyle = edit.coverColor;
          ctx.beginPath();
          points.forEach(([dx, dy], i) => {
            const x = edit.originalXPt + Math.cos(angle) * dx - Math.sin(angle) * dy;
            const y = edit.originalYPt + Math.sin(angle) * dx + Math.cos(angle) * dy;
            const [vx, vy] = viewport.convertToViewportPoint(x, y);
            if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
          });
          ctx.closePath(); ctx.fill();
        }
        const { PDFName } = await import("pdf-lib");
        const image = await pdf.embedPng(canvas.toDataURL("image/png"));
        const crop = page.getCropBox();
        page.node.set(PDFName.of("Contents"), pdf.context.obj([]));
        page.node.set(PDFName.of("Resources"), pdf.context.obj({}));
        page.drawImage(image, { x: crop.x, y: crop.y, width: crop.width, height: crop.height });
        flattened.push(Number(index) + 1);
      } finally { canvas.width = 0; canvas.height = 0; source.cleanup(); }
    }
  } finally { await loading?.destroy(); }
  return flattened;
}

type StandardFontSet = { normal: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };

/** Coordinates in the visible CropBox, including its native page rotation. */
export function editorPointToPdf(page: import("pdf-lib").PDFPage, x: number, y: number, scale: number) {
  const box = page.getCropBox();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const px = x / scale, py = y / scale;
  if (rotation === 90) return { x: box.x + py, y: box.y + px };
  if (rotation === 180) return { x: box.x + box.width - px, y: box.y + py };
  if (rotation === 270) return { x: box.x + box.width - py, y: box.y + box.height - px };
  return { x: box.x + px, y: box.y + box.height - py };
}

/** Shared width and drawing decisions keep wrapping and output in agreement. */
export async function createEditorTextWriter(pdf: PDFDocument, standard: StandardFontSet, allText: string) {
  let unicode: UnicodeFontSet | undefined;
  try { standard.normal.encodeText(allText.replace(/[\r\n\t]/g, " ")); }
  catch { unicode = await loadUnicodeFonts(pdf, allText); }
  const coverage = new Map<PDFFont, Set<number>>();
  const fontFor = (word: string, bold: boolean, italic: boolean) => {
    const font = unicode ? resolveFont(unicode, word, bold, italic) : bold && italic ? standard.boldItalic : bold ? standard.bold : italic ? standard.italic : standard.normal;
    let characters = coverage.get(font);
    if (!characters) { characters = new Set(font.getCharacterSet()); coverage.set(font, characters); }
    for (const char of word) {
      if (!/\s|[\u200c\u200d\u200e\u200f]/u.test(char) && !characters.has(char.codePointAt(0)!)) {
        throw new Error(`The replacement font does not support “${char}”. Choose a supported character before saving.`);
      }
    }
    return font;
  };
  const pieces = (text: string, bold: boolean, italic: boolean) => {
    const result: { text: string; font: PDFFont }[] = [];
    for (const part of text.split(/(\s+)/).filter(Boolean)) {
      const previous = result.at(-1);
      const font = /^\s+$/.test(part) && previous ? previous.font : fontFor(part, bold, italic);
      if (previous?.font === font) previous.text += part;
      else result.push({ text: part, font });
    }
    return result;
  };
  const width = (text: string, size: number, bold = false, italic = false) => pieces(text, bold, italic).reduce((sum, piece) => sum + piece.font.widthOfTextAtSize(piece.text, size), 0);
  const wrap = (text: string, maxWidth: number, size: number, bold: boolean, italic: boolean) => {
    const lines: string[] = [];
    for (const paragraph of text.replace(/\r/g, "").split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (width(next, size, bold, italic) <= maxWidth) { line = next; continue; }
        if (line) { lines.push(line); line = ""; }
        for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)) {
          if (line && width(line + segment, size, bold, italic) > maxWidth) { lines.push(line); line = ""; }
          line += segment;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const drawLine = async (page: import("pdf-lib").PDFPage, text: string, x: number, y: number, size: number, angle: number, color: string, bold = false, italic = false, opacity = 1) => {
    const { rgb, degrees } = await import("pdf-lib");
    const [r, g, b] = hexToRgb01(color), radians = angle * Math.PI / 180;
    const textPieces = pieces(text, bold, italic);
    if (/^[\s\d\p{P}]*[\u0600-\u06ff]/u.test(text)) textPieces.reverse();
    let advance = 0;
    for (const piece of textPieces) {
      page.drawText(piece.text, { x: x + Math.cos(radians) * advance, y: y + Math.sin(radians) * advance, size, font: piece.font, color: rgb(r, g, b), rotate: degrees(angle), opacity });
      if (unicode) trackDrawnText(piece.font, piece.text);
      advance += piece.font.widthOfTextAtSize(piece.text, size);
    }
  };
  return {
    width, wrap, drawLine,
    async drawReplacement(page: import("pdf-lib").PDFPage, obj: ExistingTextEditObject, scale: number) {
      if (!hasExistingTextChanges(obj) || !obj.newText.trim()) return;
      const before = rotatePoint(0, (obj.originalFontSizePt ?? obj.fontSizePt) * scale * 0.85, (obj.originalCanvasWidth ?? obj.width) / 2, (obj.originalCanvasHeight ?? obj.height) / 2, obj.originalCanvasRotation ?? obj.rotation);
      const after = rotatePoint(0, obj.fontSizePt * scale * 0.85, obj.width / 2, obj.height / 2, obj.rotation);
      const original = editorPointToPdf(page, (obj.originalCanvasX ?? obj.x) + before.x, (obj.originalCanvasY ?? obj.y) + before.y, scale);
      const current = editorPointToPdf(page, obj.x + after.x, obj.y + after.y, scale);
      const mx = current.x - original.x, my = current.y - original.y;
      const angle = (obj.originalTextAngle ?? 0) - (obj.rotation - (obj.originalCanvasRotation ?? obj.rotation));
      const radians = angle * Math.PI / 180;
      const lines = wrap(obj.newText, Math.max(8, obj.width / scale), obj.fontSizePt, !!obj.bold, !!obj.italic);
      for (let row = 0; row < lines.length; row++) {
        const down = row * obj.fontSizePt * 1.2;
        await drawLine(page, lines[row], obj.originalXPt + mx + Math.sin(radians) * down, obj.originalYPt + my - Math.cos(radians) * down, obj.fontSizePt, angle, obj.color, !!obj.bold, !!obj.italic);
      }
    },
    finish() { if (unicode) patchToUnicodeCmaps(unicode); },
  };
}
