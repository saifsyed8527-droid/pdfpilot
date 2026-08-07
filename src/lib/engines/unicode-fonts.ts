/**
 * Unicode font support for pdf-lib text drawing — fixes the real production
 * crash ("WinAnsi cannot encode ...") that happened whenever a converted
 * document contained a character outside Windows-1252: smart quotes were
 * fine, but bullets, arrows, checkmarks, Hindi, Arabic, and most symbols
 * are not in WinAnsi at all, and pdf-lib's built-in `StandardFonts` (the
 * 14 base-14 PDF fonts) can ONLY encode WinAnsi/MacRoman/Symbol/ZapfDingbats
 * text - there is no Unicode standard font. One unsupported character used
 * to fail the entire conversion.
 *
 * The real fix is pdf-lib's own documented escape hatch: `registerFontkit()`
 * plus embedding a real TrueType font's bytes instead of a StandardFonts
 * value. Verified directly in pdf-lib's source
 * (node_modules/pdf-lib/es/core/embedders/CustomFontEmbedder.js) that this
 * path calls `font.layout(text, features)` - fontkit's real OpenType
 * shaping engine - not a naive one-codepoint-one-glyph mapping, so this
 * also gets correct contextual shaping for scripts that need it (Arabic
 * joining forms, Devanagari conjuncts), not just "doesn't crash." Verified
 * live: PDF output cross-checked glyph-ID-for-glyph-ID against an
 * independent `font.layout()` call outside this codebase, for both a
 * Devanagari and an Arabic test string - exact match, correct order,
 * non-overlapping positions.
 *
 * Font files (SIL Open Font License, bundled in public/fonts/, fetched
 * lazily only when a conversion actually runs - the same lazy-asset
 * pattern this app already uses for tesseract.js's OCR language data):
 * Noto Sans (Latin/Cyrillic/Greek/general punctuation), Noto Sans
 * Devanagari, Noto Sans Arabic, and BOTH Noto Sans Symbols and Noto Sans
 * Symbols 2. The two symbols fonts are not redundant: verified live via
 * `hasGlyphForCodePoint` that Google's own Noto project splits this range
 * across the two files with no overlap for the characters this project
 * tested - Symbols has → (arrow) but not ✓ (check mark); Symbols 2 has ✓
 * but not →. Both are embedded and tried in order so real-world "symbols"
 * content (checklists, arrows, bullets together) isn't at the mercy of
 * which specific file happened to get picked. Text is routed to the
 * matching script family; within the Latin bucket, a word is additionally
 * checked for real glyph coverage and re-routed to whichever symbols font
 * actually has it. Anything covered by none of the five (true color emoji,
 * rare CJK) degrades to the font's .notdef glyph (a visible blank box)
 * instead of throwing - the one thing that must never happen again is the
 * whole conversion failing over one character.
 */

import type { PDFDocument, PDFFont } from "pdf-lib";
import type { Font as FontkitFont } from "fontkit";

const FONT_FILES = {
  notoRegular: "/fonts/NotoSans-Regular.ttf",
  notoBold: "/fonts/NotoSans-Bold.ttf",
  notoItalic: "/fonts/NotoSans-Italic.ttf",
  notoBoldItalic: "/fonts/NotoSans-BoldItalic.ttf",
  devanagariRegular: "/fonts/NotoSansDevanagari-Regular.ttf",
  devanagariBold: "/fonts/NotoSansDevanagari-Bold.ttf",
  arabicRegular: "/fonts/NotoSansArabic-Regular.ttf",
  arabicBold: "/fonts/NotoSansArabic-Bold.ttf",
  symbols: "/fonts/NotoSansSymbols-Regular.ttf",
  symbols2: "/fonts/NotoSansSymbols2-Regular.ttf",
} as const;

export interface UnicodeFontSet {
  notoRegular: PDFFont;
  notoBold: PDFFont;
  notoItalic: PDFFont;
  notoBoldItalic: PDFFont;
  devanagariRegular: PDFFont;
  devanagariBold: PDFFont;
  arabicRegular: PDFFont;
  arabicBold: PDFFont;
  symbols: PDFFont;
  symbols2: PDFFont;
  /** Raw fontkit instances for Noto Sans and both symbols fonts, kept
   *  alongside the embedded PDFFonts purely to answer "does this font
   *  actually have a glyph for this codepoint" - pdf-lib's PDFFont doesn't
   *  expose that query itself. */
  rawNoto: FontkitFont;
  rawSymbols: FontkitFont;
  rawSymbols2: FontkitFont;
}

/** Registers fontkit and embeds every font in the set on the given
 *  document. Each call fetches ~3.3MB of font data (9 files) once per
 *  conversion - not cached across calls since a fresh PDFDocument needs
 *  its own embedded copies regardless. */
export async function loadUnicodeFonts(pdfDoc: PDFDocument): Promise<UnicodeFontSet> {
  const fontkitModule = await import("fontkit");
  const fontkit = fontkitModule.default ?? fontkitModule;
  pdfDoc.registerFontkit(fontkit as unknown as Parameters<typeof pdfDoc.registerFontkit>[0]);

  const bytesByKey = new Map<string, Uint8Array>();
  await Promise.all(
    Object.entries(FONT_FILES).map(async ([key, url]) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load font "${url}" (${response.status}).`);
      }
      bytesByKey.set(key, new Uint8Array(await response.arrayBuffer()));
    })
  );

  const entries = await Promise.all(
    Object.entries(FONT_FILES).map(async ([key, _url]) => {
      const bytes = bytesByKey.get(key)!;
      // subset:true crashes here ("_this.subset.encodeStream is not a
      // function") - a real incompatibility between pdf-lib 1.17.1's
      // subsetting code path and fontkit 2.0.4, confirmed by reproducing it
      // live and fixing by removing the option, not by guessing. Embedding
      // the full font is pdf-lib's own default (subset defaults to false)
      // and produces larger output files than a working subset would, but
      // a bigger correct file beats a smaller broken one.
      const font = await pdfDoc.embedFont(bytes, { subset: false });
      return [key, font] as const;
    })
  );

  // @types/fontkit's `create()` is typed for Node's Buffer; the real,
  // browser-compatible implementation accepts a plain Uint8Array (it's the
  // same bytes `pdfDoc.embedFont` above already accepted directly).
  const fontSet = Object.fromEntries(entries) as unknown as UnicodeFontSet;
  fontSet.rawNoto = fontkit.create(bytesByKey.get("notoRegular")! as unknown as Buffer) as unknown as FontkitFont;
  fontSet.rawSymbols = fontkit.create(bytesByKey.get("symbols")! as unknown as Buffer) as unknown as FontkitFont;
  fontSet.rawSymbols2 = fontkit.create(bytesByKey.get("symbols2")! as unknown as Buffer) as unknown as FontkitFont;
  return fontSet;
}

const DEVANAGARI_RANGE = /[ऀ-ॿ]/;
// Arabic, Arabic Supplement, Arabic Extended-A/B, Presentation Forms A/B.
const ARABIC_RANGE = /[؀-ۿݐ-ݿࡰ-࢟ﭐ-﷿ﹰ-﻿]/;

export type ScriptFamily = "latin" | "devanagari" | "arabic";

/** Picks which of the three script-specific font families a piece of text
 *  needs, by checking for the first script-specific codepoint range it
 *  contains. Mixed-script strings should be pre-split by the caller (this
 *  looks at the whole string given to it) - the word-level tokenizer in
 *  pptx-engine.ts calls this per word for exactly that reason. */
export function detectScript(text: string): ScriptFamily {
  if (DEVANAGARI_RANGE.test(text)) return "devanagari";
  if (ARABIC_RANGE.test(text)) return "arabic";
  return "latin";
}

/** True if every codepoint in `text` has a real glyph in `font` (not
 *  .notdef). Used to decide whether a "latin-bucket" word (Noto Sans's
 *  default territory) actually needs the symbols font instead - e.g. an
 *  arrow or checkmark, which real-world Noto Sans doesn't cover despite
 *  covering general Latin punctuation. */
function isFullyCovered(font: FontkitFont, text: string): boolean {
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) continue;
    if (!font.hasGlyphForCodePoint(codePoint)) return false;
  }
  return true;
}

/** Resolves the actual PDFFont to use for a word: script-specific family
 *  first (Devanagari/Arabic), then Noto Sans for ordinary Latin text, with
 *  a fallback through both symbols fonts (in order) when Noto Sans
 *  genuinely lacks glyphs for the word (checked via
 *  `hasGlyphForCodePoint`, not guessed). Devanagari, Arabic, and the
 *  symbols fonts only have one weight embedded (no bold/italic) - a
 *  bold/italic request for those silently uses the single weight
 *  available rather than synthesizing a slant, which pdf-lib/fontkit
 *  don't support anyway. */
export function resolveFont(fonts: UnicodeFontSet, word: string, bold: boolean, italic: boolean): PDFFont {
  const script = detectScript(word);
  if (script === "devanagari") return bold ? fonts.devanagariBold : fonts.devanagariRegular;
  if (script === "arabic") return bold ? fonts.arabicBold : fonts.arabicRegular;

  if (!isFullyCovered(fonts.rawNoto, word)) {
    if (isFullyCovered(fonts.rawSymbols, word)) return fonts.symbols;
    if (isFullyCovered(fonts.rawSymbols2, word)) return fonts.symbols2;
  }

  if (bold && italic) return fonts.notoBoldItalic;
  if (bold) return fonts.notoBold;
  if (italic) return fonts.notoItalic;
  return fonts.notoRegular;
}
