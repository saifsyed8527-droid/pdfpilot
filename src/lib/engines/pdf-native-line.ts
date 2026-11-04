import { Encodings, Font, FontNames } from "@pdf-lib/standard-fonts";
import { PDFArray, PDFDict, PDFName, PDFNumber } from "pdf-lib";

const name = PDFName.of;
const number = (value: unknown) => value instanceof PDFNumber ? value.asNumber() : NaN;
const validWidth = (value: number) => Number.isFinite(value) && value >= 0;

/** Horizontal CID fonts store advances as a default and a list of exceptions.
 * Each exception is either a sequence of widths or a constant-width range. */
function cidAdvances(font: PDFDict) {
  const descendants = font.lookup(name("DescendantFonts"));
  const child = descendants instanceof PDFArray && descendants.size() === 1 ? descendants.lookup(0) : undefined;
  if (!(child instanceof PDFDict) || !["/CIDFontType0", "/CIDFontType2"].includes(child.get(name("Subtype"))?.toString() ?? "")) return null;
  const fallback = child.has(name("DW")) ? number(child.lookup(name("DW"))) : 1000;
  const ranges = child.lookup(name("W")), widths = new Map<number, number>();
  if (!validWidth(fallback) || (ranges && !(ranges instanceof PDFArray))) return null;
  if (ranges instanceof PDFArray) {
    let previousEnd = -1;
    for (let i = 0; i < ranges.size();) {
      const first = number(ranges.lookup(i++)), next = ranges.lookup(i++);
      const end = next instanceof PDFArray ? first + next.size() - 1 : number(next);
      if (!Number.isInteger(first) || !Number.isInteger(end) || first <= previousEnd || end < first || end > 65535) return null;
      const constant = next instanceof PDFArray ? 0 : number(ranges.lookup(i++));
      for (let cid = first; cid <= end; cid++) {
        const width = next instanceof PDFArray ? number(next.lookup(cid - first)) : constant;
        if (!validWidth(width)) return null;
        widths.set(cid, width);
      }
      previousEnd = end;
    }
  }
  return (code: number) => widths.get(code) ?? fallback;
}

function simpleAdvances(font: PDFDict) {
  const first = number(font.lookup(name("FirstChar"))), last = number(font.lookup(name("LastChar")));
  const widths = font.lookup(name("Widths"));
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last > 255 || last < first
    || !(widths instanceof PDFArray) || widths.size() !== last - first + 1) return null;
  const values = widths.asArray().map((_, i) => number(widths.lookup(i)));
  return values.every(validWidth) ? (code: number) => values[code - first] ?? NaN : null;
}

/** A short, unstyled replacement can use the original PDF font and paint
 * order when every character has a unique code and fits the source width. */
export function nativeLineEncoder(font: PDFDict, unicode?: ReadonlyMap<number, string> | null) {
  let widthOf: (code: number) => number, codeOf: (char: string) => number | undefined;
  const composite = font.get(name("Subtype"))?.toString() === "/Type0";
  if (unicode) {
    const subtype = font.get(name("Subtype"))?.toString() ?? "";
    if (composite ? font.get(name("Encoding"))?.toString() !== "/Identity-H" : !["/Type1", "/TrueType"].includes(subtype)) return null;
    const advances = composite ? cidAdvances(font) : simpleAdvances(font);
    if (!advances) return null;
    const codes = new Map<string, number | undefined>();
    for (const [cid, char] of unicode) if (cid !== 0) codes.set(char, codes.has(char) ? undefined : cid);
    widthOf = advances;
    codeOf = char => codes.get(char);
  } else {
    const base = font.get(name("BaseFont"))?.toString().slice(1);
    if (!base || !Object.values(FontNames).includes(base as FontNames) || ["Symbol", "ZapfDingbats"].includes(base)
      || font.get(name("Subtype"))?.toString() !== "/Type1" || font.get(name("Encoding"))?.toString() !== "/WinAnsiEncoding"
      || ["Widths", "FontDescriptor", "ToUnicode"].some(key => font.has(name(key)))) return null;
    const standard = Font.load(base as FontNames), enc = Encodings.WinAnsi;
    const widths = new Map<number, number>();
    for (const cp of enc.supportedCodePoints) {
      const glyph = enc.encodeUnicodeCodePoint(cp), width = standard.getWidthOfGlyph(glyph.name);
      if (typeof width === "number") widths.set(glyph.code, width);
    }
    widthOf = code => widths.get(code) ?? NaN;
    codeOf = char => enc.canEncodeUnicodeCodePoint(char.codePointAt(0)!) ? enc.encodeUnicodeCodePoint(char.codePointAt(0)!).code : undefined;
  }
  return (source: Uint8Array[], replacement: string, kern = 0): string | null => {
    // Combining and bidirectional scripts need shaping. The existing Unicode
    // writer handles them, line wrapping and characters missing in subsets.
    if (!/^[\u0020-\u007e\u00a0-\u02af\u0370-\u052f\u2010-\u2027\u20a0-\u20cf]+$/u.test(replacement)
      || /[\p{M}\p{Cf}]/u.test(replacement) || !replacement.trim()) return null;
    // TJ adjustments are subtracted from the horizontal advance, in the
    // same thousandths of a text unit as the font widths.
    let before = -kern, after = 0, hex = "";
    const stride = composite ? 2 : 1;
    for (const bytes of source) {
      if (composite && bytes.length % 2) return null;
      for (let i = 0; i < bytes.length; i += stride) before += widthOf(composite ? bytes[i] * 256 + bytes[i + 1] : bytes[i]);
    }
    for (const char of replacement) {
      const code = codeOf(char);
      if (code === undefined) return null;
      const width = widthOf(code);
      if (!validWidth(width) || width === 0) return null;
      after += width;
      hex += code.toString(16).padStart(composite ? 4 : 2, "0");
    }
    return Number.isFinite(before) && after <= before ? `<${hex}>` : null;
  };
}
