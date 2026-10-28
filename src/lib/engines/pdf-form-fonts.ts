import type { PDFDocument, PDFFont } from "pdf-lib";
import { loadUnicodeFonts, patchToUnicodeCmaps, resolveFont, trackDrawnText } from "./unicode-fonts";

/** Each interactive field appearance uses one embedded font, checked before export. */
export async function createFormFontProvider(pdf: PDFDocument, allText: string) {
  const { StandardFonts } = await import("pdf-lib");
  const standard = await pdf.embedFont(StandardFonts.Helvetica);
  let unicode: Awaited<ReturnType<typeof loadUnicodeFonts>> | undefined;
  try { standard.encodeText(allText.replace(/[\r\n\t]/g, " ")); }
  catch { unicode = await loadUnicodeFonts(pdf, allText); }
  const coverage = new Map<PDFFont, Set<number>>();
  return {
    forText(text: string, fieldName: string): PDFFont {
      let font = standard;
      try { standard.encodeText(text.replace(/[\r\n\t]/g, " ")); }
      catch { if (unicode) font = resolveFont(unicode, text, false, false); }
      let characters = coverage.get(font);
      if (!characters) { characters = new Set(font.getCharacterSet()); coverage.set(font, characters); }
      for (const char of text) {
        if (!/\s|[\u200c\u200d\u200e\u200f]/u.test(char) && !characters.has(char.codePointAt(0)!)) {
          throw new Error(`Field “${fieldName}” contains “${char}”, which the available form fonts cannot display. Use supported text before saving.`);
        }
      }
      if (unicode && font !== standard) for (const line of text.split(/[\r\n]+/)) trackDrawnText(font, line);
      return font;
    },
    finish() { if (unicode) patchToUnicodeCmaps(unicode); },
  };
}
