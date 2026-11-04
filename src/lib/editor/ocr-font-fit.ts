import { editorScriptFamily } from "./script-fonts";
import type { Font } from "fontkit";

const cache = new Map<string, Promise<Font>>();
let standardFont: Promise<import("pdf-lib").PDFFont> | undefined;
/** Match the exporter's real regular-font advances. Ink height alone is a
 * poor font-size estimate for Arabic, combining marks and small capitals. */
export async function measureEditorOcrLine(text: string, signal: AbortSignal): Promise<number> {
  const fontkit = await import("fontkit");
  const get = (family: string) => {
    let promise = cache.get(family);
    if (!promise) {
      const extra = !["", "Arabic", "Devanagari"].includes(family);
      const url = `/fonts/${extra ? "editor-v1/" : ""}NotoSans${family}-Regular.${family === "CJKjp" ? "otf" : "ttf"}`;
      promise = fetch(url, { signal }).then(async response => {
        if (!response.ok) throw new Error("A text font could not load. Check your connection and recognize this page again.");
        const bytes = new Uint8Array(await response.arrayBuffer());
        return fontkit.create(bytes as unknown as Buffer) as Font;
      }).catch(error => { cache.delete(family); throw error; });
      cache.set(family, promise);
    }
    return promise;
  };
  const pieces: { family: string; text: string }[] = [];
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)) {
    const previous = pieces.at(-1);
    const family = /^\s+$/.test(segment) && previous ? previous.family : editorScriptFamily(segment)
      ?? (/\p{Script=Devanagari}/u.test(segment) ? "Devanagari" : /\p{Script=Arabic}/u.test(segment) ? "Arabic" : "");
    if (previous?.family === family) previous.text += segment;
    else pieces.push({ family, text: segment });
  }
  let width = 0;
  for (const piece of pieces) {
    if (signal.aborted) throw new DOMException("OCR cancelled", "AbortError");
    const font = await get(piece.family);
    const run = font.layout(piece.text);
    width += run.positions.reduce((sum, position) => sum + position.xAdvance, 0) / font.unitsPerEm;
  }
  // ASCII-only documents use the editor's standard Helvetica font. When
  // another edited line uses Unicode, this same line instead uses Noto Sans.
  // Fit both possible exports without knowing the user's later edits.
  if (/^[\x20-\x7e]+$/.test(text)) {
    standardFont ??= import("pdf-lib").then(async ({ PDFDocument, StandardFonts }) => (await PDFDocument.create()).embedFont(StandardFonts.Helvetica));
    width = Math.max(width, (await standardFont).widthOfTextAtSize(text, 1));
  }
  if (signal.aborted) throw new DOMException("OCR cancelled", "AbortError");
  return width;
}
