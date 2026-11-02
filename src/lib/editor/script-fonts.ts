import type { PDFDocument, PDFFont } from "pdf-lib";

const FAMILIES: [RegExp, string][] = [
  [/\p{Script=Bengali}/u, "Bengali"], [/\p{Script=Gujarati}/u, "Gujarati"],
  [/\p{Script=Gurmukhi}/u, "Gurmukhi"], [/\p{Script=Hebrew}/u, "Hebrew"],
  [/\p{Script=Kannada}/u, "Kannada"], [/\p{Script=Malayalam}/u, "Malayalam"],
  [/\p{Script=Tamil}/u, "Tamil"], [/\p{Script=Telugu}/u, "Telugu"],
  [/\p{Script=Thai}/u, "Thai"],
  [/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff00-\uffef]/u, "CJKjp"],
];

export function editorScriptFamily(text: string): string | undefined {
  return FAMILIES.find(([pattern]) => pattern.test(text))?.[1];
}

export function needsPositionedEditorText(text: string): boolean {
  return /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Bengali}\p{Script=Gujarati}\p{Script=Gurmukhi}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Thai}]/u.test(text);
}

/** One pan-CJK family covers Han, kana and Hangul. Replacement glyphs use
 * its Japanese regional forms; original PDF fonts are not reconstructed. */
export async function loadEditorScriptFonts(pdf: PDFDocument, text: string) {
  const fonts = new Map<string, { normal: PDFFont; bold: PDFFont }>();
  for (const [pattern, family] of FAMILIES) {
    if (!pattern.test(text)) continue;
    const pair = await Promise.all(["Regular", "Bold"].map(async weight => {
      const response = await fetch(`/fonts/editor-v1/NotoSans${family}-${weight}.${family === "CJKjp" ? "otf" : "ttf"}`);
      if (!response.ok) throw new Error("A replacement font could not load. Check your connection and try saving again.");
      const font = await pdf.embedFont(await response.arrayBuffer(), { subset: true });
      // pdf-lib 1.17 expects fontkit 1's encodeStream(); fontkit 2.0.4 exposes
      // the same subset bytes through encode(). Adapt only serialization;
      // pdf-lib still owns glyph/CID mapping, widths and the embedded font.
      const embedder = (font as unknown as { embedder: { subset: { encode?: () => Uint8Array; encodeStream?: unknown }; serializeFont: () => Promise<Uint8Array> } }).embedder;
      if (typeof embedder.subset.encodeStream !== "function") {
        if (typeof embedder.subset.encode !== "function") throw new Error("The replacement font could not be prepared. Please reload and retry.");
        embedder.serializeFont = async () => new Uint8Array(embedder.subset.encode!());
      }
      return font;
    }));
    fonts.set(family, { normal: pair[0], bold: pair[1] });
  }
  return {
    pick(text: string, bold: boolean): PDFFont | undefined {
      const family = editorScriptFamily(text);
      const pair = family ? fonts.get(family) : undefined;
      return bold ? pair?.bold : pair?.normal;
    },
    all: [...fonts.values()].flatMap(pair => [pair.normal, pair.bold]),
  };
}
