import { PDFString, PDFHexString, PDFOperator, PDFOperatorNames, PDFNumber, type PDFDocument, type PDFPage } from "pdf-lib";

/** A valid embedded glyphless TrueType font, as used by Tesseract's PDF renderer.
 * Rendering mode 3 never paints; explicit ToUnicode mappings preserve logical
 * Unicode without shaping or substituting unsupported scripts. */
export async function createOcrTextLayer(pdf: PDFDocument, signal?: AbortSignal) {
  const bidi = (await import("../vendor/bidi-js/bidi.min.mjs")).default();
  const response = await fetch("/tesseract/pdf.ttf", { signal });
  if (!response.ok) throw new Error("The searchable-text font could not load. Please retry.");
  const bytes = new Uint8Array(await response.arrayBuffer()), context = pdf.context;
  if (bytes.length !== 572) throw new Error("The searchable-text font is unavailable. Please reload and retry.");
  const file = context.register(context.flateStream(bytes, { Length1: bytes.length }));
  const descriptor = context.register(context.obj({ Type: "FontDescriptor", FontName: "GlyphLessFont", Flags: 5, FontBBox: [0, 0, 500, 1000], ItalicAngle: 0, Ascent: 1000, Descent: -1, CapHeight: 1000, StemV: 80, FontFile2: file }));
  const mapping = new Uint8Array(131072); for (let i = 1; i < mapping.length; i += 2) mapping[i] = 1;
  const cidToGid = context.register(context.flateStream(mapping));
  const descendant = context.register(context.obj({ Type: "Font", Subtype: "CIDFontType2", BaseFont: "GlyphLessFont", CIDSystemInfo: { Registry: PDFString.of("Adobe"), Ordering: PDFString.of("Identity"), Supplement: 0 }, FontDescriptor: descriptor, CIDToGIDMap: cidToGid, DW: 500, W: [1, [0]] }));
  const toUnicode = context.nextRef();
  const font = context.register(context.obj({ Type: "Font", Subtype: "Type0", BaseFont: "GlyphLessFont", Encoding: "Identity-H", DescendantFonts: [descendant], ToUnicode: toUnicode }));
  // An explicit zero-advance space separates OCR words even in extractors that
  // do not infer spacing from their bounding boxes. Word geometry stays exact.
  const characters = new Map<string, number>([[" ", 2]]), fonts = new Map<PDFPage, ReturnType<PDFPage["node"]["newFontDictionary"]>>();
  const number = (n: number) => PDFNumber.of(n);
  return {
    draw(page: PDFPage, text: string, origin: number[], end: number[], top: number[]) {
      // PDF readers reconstruct logical order from visual glyph order. Applying
      // the Unicode bidi algorithm also keeps embedded numbers in their order.
      const visual = /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(text) ? bidi.getReorderedString(text, bidi.getEmbeddingLevels(text)) : text;
      const chars = [...visual], width = Math.hypot(end[0] - origin[0], end[1] - origin[1]), height = Math.hypot(top[0] - origin[0], top[1] - origin[1]);
      if (!chars.length || width <= 0 || height <= 0 || ![...origin, ...end, ...top, width, height].every(Number.isFinite)) return;
      let encoded = "";
      for (const char of chars) {
        if (!characters.has(char)) { if (characters.size >= 65533) throw new Error("Too many distinct characters. OCR fewer pages at a time."); characters.set(char, characters.size + 2); }
        encoded += characters.get(char)!.toString(16).padStart(4, "0");
      }
      let name = fonts.get(page); if (!name) { name = page.node.newFontDictionary("OCR", font); fonts.set(page, name); }
      const a = (end[0] - origin[0]) / width, b = (end[1] - origin[1]) / width;
      const stretch = width / (0.5 * height * chars.length);
      page.pushOperators(
        PDFOperator.of(PDFOperatorNames.PushGraphicsState), PDFOperator.of(PDFOperatorNames.BeginText),
        PDFOperator.of(PDFOperatorNames.SetTextRenderingMode, [number(3)]),
        PDFOperator.of(PDFOperatorNames.SetFontAndSize, [name, number(height)]),
        PDFOperator.of(PDFOperatorNames.SetTextHorizontalScaling, [number(100)]),
        PDFOperator.of(PDFOperatorNames.SetTextMatrix, [number(a * stretch), number(b * stretch), number(-b), number(a), number(origin[0]), number(origin[1])]),
        PDFOperator.of(PDFOperatorNames.ShowText, [PDFHexString.of(encoded + "0001")]),
        PDFOperator.of(PDFOperatorNames.EndText), PDFOperator.of(PDFOperatorNames.PopGraphicsState),
      );
    },
    finish() {
      const pairs = ["<0001> <0020>", ...[...characters].map(([char, id]) => `<${id.toString(16).padStart(4, "0")}> <${PDFHexString.fromText(char).asString().slice(4)}>` )];
      let cmap = "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /PDFPilotOCR-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n";
      for (let i = 0; i < pairs.length; i += 100) { const group = pairs.slice(i, i + 100); cmap += `${group.length} beginbfchar\n${group.join("\n")}\nendbfchar\n`; }
      cmap += "endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n";
      context.assign(toUnicode, context.flateStream(cmap));
    },
  };
}
