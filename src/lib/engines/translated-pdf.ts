import type { TranslatedPage } from "./pdf-translation";
import { checkTranslation, TranslationInputError } from "./pdf-translation";
import { createEditorTextWriter } from "../editor/text-replacement";

/** A readable text document, with explicit source-page boundaries. Original
 * columns, pictures and typography are not represented as preserved layout. */
export async function createTranslatedPdf(
  pages: TranslatedPage[],
  options: { bilingual?: boolean; signal?: AbortSignal } = {},
): Promise<Blob> {
  checkTranslation(options.signal);
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const standard = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const text = pages
    .flatMap((p) => [...(options.bilingual ? p.original : []), ...p.translated])
    .join("\n");
  if (text.length > 1_200_000)
    throw new TranslationInputError("Choose fewer pages for PDF output.");
  const writer = await createEditorTextWriter(pdf, standard, text, {
    vectorText: true,
  });
  const textLayer = await (
    await import("./ocr-text-layer")
  ).createOcrTextLayer(pdf, options.signal);
  const width = 595.28,
    height = 841.89,
    margin = 46,
    usable = width - 2 * margin;
  let page: import("pdf-lib").PDFPage,
    y = 0;
  const nextPage = () => {
    checkTranslation(options.signal);
    if (pdf.getPageCount() >= 500)
      throw new TranslationInputError(
        "Translation exceeds 500 output pages. Choose fewer source pages.",
      );
    page = pdf.addPage([width, height]);
    y = height - margin;
  };
  const paragraph = async (value: string, size = 11, bold = false) => {
    const lines = writer.wrap(value, usable, size, bold, false);
    for (const line of lines) {
      checkTranslation(options.signal);
      if (y - size * 1.65 < margin) nextPage();
      const rtl =
        (line.match(/[\p{Script=Arabic}\p{Script=Hebrew}]/gu)?.length ?? 0) >
        (line.match(/\p{L}/gu)?.length ?? 0) / 2;
      const lineX = rtl
        ? width - margin - writer.width(line, size, bold)
        : margin;
      const outlined = await writer.drawVectorLine(
        page,
        line,
        lineX,
        y - size,
        size,
        0,
        "#172033",
        bold,
      );
      if (outlined)
        textLayer.draw(
          page,
          line,
          [lineX, y - size],
          [lineX + writer.width(line, size, bold), y - size],
          [lineX, y],
        );
      else
        await writer.drawLine(
          page,
          line,
          lineX,
          y - size,
          size,
          0,
          "#172033",
          bold,
        );
      y -= size * 1.65;
    }
    y -= size * 0.6;
  };
  for (const item of pages) {
    nextPage();
    await paragraph(`Source page ${item.pageNumber}`, 14, true);
    if (options.bilingual) {
      await paragraph("Original", 12, true);
      for (const p of item.original) await paragraph(p);
      await paragraph("Translation", 12, true);
    }
    if (!item.translated.length)
      await paragraph("No readable text on this page.");
    for (const [i, text] of item.translated.entries())
      await paragraph(
        text,
        item.paragraphStyles[i] === "heading1"
          ? 17
          : item.paragraphStyles[i] === "heading2"
            ? 13
            : 11,
        item.paragraphStyles[i] !== "body",
      );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  checkTranslation(options.signal);
  writer.finish();
  textLayer.finish();
  const bytes = await pdf.save();
  checkTranslation(options.signal);
  if (bytes.length > 100 * 1024 * 1024)
    throw new TranslationInputError(
      "The translated PDF exceeds 100MB. Choose fewer pages.",
    );
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
