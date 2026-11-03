import type { PDFDocument, PDFFont } from "pdf-lib";
import type { ExistingTextEditObject, PagesObjects } from "./types";
import { hasExistingTextChanges, hexToRgb01, rotatePoint } from "./types";
import { removeIndependentPageText } from "../engines/pdf-content-text";
import { loadUnicodeFonts, patchToUnicodeCmaps, patchFontToUnicodeCmap, resolveFont, trackDrawnText, type UnicodeFontSet } from "../engines/unicode-fonts";
import { loadEditorScriptFonts, needsPositionedEditorText } from "./script-fonts";
import { visualPageGeometry } from "../engines/pdf-visual-page";

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
          const quad = edit.originalInkQuad ?? points.map(([dx, dy]) => [edit.originalXPt + Math.cos(angle) * dx - Math.sin(angle) * dy, edit.originalYPt + Math.sin(angle) * dx + Math.cos(angle) * dy]);
          quad.forEach(([x, y], i) => {
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

function shaped(font: PDFFont, text: string) {
  const raw = (font as unknown as { embedder: { font: import("fontkit").Font } }).embedder.font;
  return { run: raw.layout(text), units: raw.unitsPerEm };
}

/** Coordinates in the visible CropBox, including its native page rotation. */
export function editorPointToPdf(page: import("pdf-lib").PDFPage, x: number, y: number, scale: number) {
  const { height, matrix: [a, b, c, d, e, f] } = visualPageGeometry(page);
  const px = x / scale, py = height - y / scale;
  return { x: a * px + c * py + e, y: b * px + d * py + f };
}

/** Shared width and drawing decisions keep wrapping and output in agreement. */
export async function createEditorTextWriter(pdf: PDFDocument, standard: StandardFontSet, allText: string, options: { vectorText?: boolean } = {}) {
  let unicode: UnicodeFontSet | undefined;
  try { standard.normal.encodeText(allText.replace(/[\r\n\t]/g, " ")); }
  catch { unicode = await loadUnicodeFonts(pdf, allText); }
  const extra = unicode ? await loadEditorScriptFonts(pdf, allText) : undefined;
  const bidi = unicode && /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(allText) ? (await import("../vendor/bidi-js/bidi.min.mjs")).default() : undefined;
  const coverage = new Map<PDFFont, Set<number>>();
  const fontFor = (word: string, bold: boolean, italic: boolean) => {
    const font = extra?.pick(word, bold) ?? (unicode ? resolveFont(unicode, word, bold, italic) : bold && italic ? standard.boldItalic : bold ? standard.bold : italic ? standard.italic : standard.normal);
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
    const result: { text: string; font: PDFFont; start: number; level: number }[] = [];
    const levels = bidi?.getEmbeddingLevels(text).levels;
    let start = 0;
    // Grapheme boundaries retain combining marks and Indic conjuncts while
    // allowing mixed-script words such as “Total金額125” to use real glyphs.
    for (const { segment: part } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)) {
      const previous = result.at(-1);
      const font = /^\s+$/.test(part) && previous ? previous.font : fontFor(part, bold, italic);
      const level = levels?.[start] ?? 0;
      const rtlWordBoundary = level % 2 === 1 && (/^\s+$/.test(part) || /\s$/.test(previous?.text ?? ""));
      if (previous?.font === font && previous.level === level && !rtlWordBoundary) previous.text += part;
      else result.push({ text: part, font, start, level });
      start += part.length;
    }
    return result;
  };
  const pieceWidth = (piece: { text: string; font: PDFFont }, size: number) => {
    if (!unicode || (!options.vectorText && !needsPositionedEditorText(piece.text))) return piece.font.widthOfTextAtSize(piece.text, size);
    const { run, units } = shaped(piece.font, piece.text);
    return run.positions.reduce((sum, position) => sum + position.xAdvance, 0) / units * size;
  };
  const width = (text: string, size: number, bold = false, italic = false) => pieces(text, bold, italic).reduce((sum, piece) => sum + pieceWidth(piece, size), 0);
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
  const visualPieces = (text: string, bold: boolean, italic: boolean) => {
    const textPieces = pieces(text, bold, italic);
    if (bidi) {
      const order = bidi.getReorderedIndices(text, bidi.getEmbeddingLevels(text)), ranks = new Map(order.map((original, visual) => [original, visual]));
      const positions = new Map(textPieces.map(piece => {
        let rank = Infinity;
        for (let i = 0; i < piece.text.length; i++) rank = Math.min(rank, ranks.get(piece.start + i) ?? 0);
        return [piece, rank] as const;
      }));
      textPieces.sort((a, b) => positions.get(a)! - positions.get(b)!);
    }
    return textPieces;
  };
  let outlineWriter: ReturnType<typeof import("../engines/pdf-glyph-outlines").createGlyphOutlineWriter> | undefined;
  const drawVectorLine = async (page: import("pdf-lib").PDFPage, text: string, x: number, y: number, size: number, angle: number, color: string, bold = false, italic = false) => {
    if (!unicode) return false;
    outlineWriter ??= (await import("../engines/pdf-glyph-outlines")).createGlyphOutlineWriter(pdf);
    const radians = angle * Math.PI / 180;
    let advance = 0;
    for (const piece of visualPieces(text, bold, italic)) {
      const raw = (piece.font as unknown as { embedder: { font: import("fontkit").Font } }).embedder.font;
      const run = raw.layout(piece.text);
      outlineWriter.draw(page, raw, run, x + Math.cos(radians) * advance, y + Math.sin(radians) * advance, size, angle, hexToRgb01(color));
      advance += pieceWidth(piece, size);
    }
    return true;
  };
  const drawLine = async (page: import("pdf-lib").PDFPage, text: string, x: number, y: number, size: number, angle: number, color: string, bold = false, italic = false, opacity = 1) => {
    const { rgb, degrees, PDFName, PDFHexString, PDFOperator, pushGraphicsState, popGraphicsState, beginText, endText, setFontAndSize, setTextMatrix, showText, setFillingRgbColor, setGraphicsState } = await import("pdf-lib");
    const [r, g, b] = hexToRgb01(color), radians = angle * Math.PI / 180;
    const textPieces = visualPieces(text, bold, italic);
    // Preserve Indic logical clusters for readers supporting ActualText. RTL
    // readers reconstruct direction from positioned glyphs; substituting one
    // line-wide ActualText span can make them reverse the text a second time.
    const actualText = unicode && !/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(text);
    if (actualText) page.pushOperators(PDFOperator.of("BDC" as import("pdf-lib").PDFOperatorNames, [PDFName.of("Span"), pdf.context.obj({ ActualText: PDFHexString.fromText(text) }).toString()]));
    let advance = 0;
    for (const piece of textPieces) {
      if (!unicode || !needsPositionedEditorText(piece.text)) {
        page.drawText(piece.text, { x: x + Math.cos(radians) * advance, y: y + Math.sin(radians) * advance, size, font: piece.font, color: rgb(r, g, b), rotate: degrees(angle), opacity });
        if (unicode) trackDrawnText(piece.font, piece.text);
      }
      else {
        const rtlWord = bidi && /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(piece.text);
        if (rtlWord) page.pushOperators(PDFOperator.of("BDC" as import("pdf-lib").PDFOperatorNames, [PDFName.of("Span"), pdf.context.obj({ ActualText: PDFHexString.fromText(bidi!.getReorderedString(piece.text, bidi!.getEmbeddingLevels(piece.text))) }).toString()]));
        const { run, units } = shaped(piece.font, piece.text), encoded = piece.font.encodeText(piece.text).asString();
        const name = page.node.newFontDictionary(piece.font.name, piece.font.ref);
        const state = page.node.newExtGState("EditorText", pdf.context.obj({ Type: "ExtGState", ca: opacity }));
        page.pushOperators(pushGraphicsState(), setGraphicsState(state), beginText(), setFontAndSize(name, size), setFillingRgbColor(r, g, b));
        let pen = 0;
        for (const [i, position] of run.positions.entries()) {
          const dx = advance + pen + position.xOffset / units * size, dy = position.yOffset / units * size;
          page.pushOperators(setTextMatrix(Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), x + Math.cos(radians) * dx - Math.sin(radians) * dy, y + Math.sin(radians) * dx + Math.cos(radians) * dy), showText(PDFHexString.of(encoded.slice(i * 4, i * 4 + 4))));
          pen += position.xAdvance / units * size;
        }
        page.pushOperators(endText(), popGraphicsState());
        if (rtlWord) page.pushOperators(PDFOperator.of("EMC" as import("pdf-lib").PDFOperatorNames));
        trackDrawnText(piece.font, piece.text);
      }
      advance += pieceWidth(piece, size);
    }
    if (actualText) page.pushOperators(PDFOperator.of("EMC" as import("pdf-lib").PDFOperatorNames));
  };
  return {
    width, wrap, drawLine, drawVectorLine,
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
    finish() { if (unicode) patchToUnicodeCmaps(unicode); extra?.all.forEach(patchFontToUnicodeCmap); },
  };
}
