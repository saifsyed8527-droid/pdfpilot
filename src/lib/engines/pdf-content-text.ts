/**
 * Real PDF content-stream text replacement for PDF Forms' Edit Text tool.
 *
 * This is a genuine alternative to the cover-and-redraw strategy: it
 * tokenizes a page's actual content stream (the PDF operators that draw
 * its text), locates the specific text-showing operator that produced a
 * given extracted text run (matched by position + font + text, since
 * pdfjs's `getTextContent()` doesn't expose byte offsets into the raw
 * stream), and replaces JUST that operator's string operand in place -
 * leaving every other byte of the content stream untouched. The result:
 * the old string is gone from the content stream, not merely painted
 * over, and copy/paste, text search, and text extraction all see the new
 * text and never the old one.
 *
 * Scope and honest limits (see `canReplaceInPlace`): this only works for
 * a *simple* font (Type1/TrueType/MMType1 with a WinAnsi-ish single-byte
 * encoding) showing text via Tj/TJ/'/"" - the overwhelming common case for
 * both this app's own generated PDFs and the vast majority of real-world
 * producers for plain Latin text. It does NOT attempt to rewrite Type0/
 * CID composite fonts (glyph-index encoded against a specific embedded
 * subset - a new string may reference glyphs the subset never embedded,
 * so this is not something that can be done safely by byte-swapping) or
 * text inside nested Form XObjects. Those cases - and any run this
 * tokenizer fails to re-locate with confidence - are reported back to the
 * caller as "not directly editable", so it can fall back to the
 * cover-and-redraw strategy for exactly those runs, and only those runs.
 */

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

import { readIdentityUnicodeMap } from "./pdf-identity-text";

type TokenType = "num" | "str" | "name" | "arr_start" | "arr_end" | "dict_start" | "dict_end" | "op";

interface Token {
  type: TokenType;
  start: number;
  end: number;
  /** Decoded value for num/str/name/op tokens. For "str", this is the raw
   *  decoded byte sequence (not text-decoded - encoding depends on the
   *  active font, resolved later). */
  num?: number;
  bytes?: Uint8Array;
  text?: string;
}

const WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIMITERS = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

function isWhitespace(b: number) {
  return WHITESPACE.has(b);
}
function isDelimiter(b: number) {
  return DELIMITERS.has(b);
}
function isRegular(b: number) {
  return !isWhitespace(b) && !isDelimiter(b);
}

function hexVal(b: number): number {
  if (b >= 0x30 && b <= 0x39) return b - 0x30;
  if (b >= 0x41 && b <= 0x46) return b - 0x41 + 10;
  if (b >= 0x61 && b <= 0x66) return b - 0x61 + 10;
  return -1;
}

/** Tokenizes a PDF content stream. Inline images (BI...ID...EI) are
 *  skipped as a single opaque region since their binary payload can
 *  contain byte sequences that look like tokens/operators. */
export function tokenizeContentStream(bytes: Uint8Array): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = bytes.length;

  while (i < n) {
    const b = bytes[i];

    if (isWhitespace(b)) {
      i++;
      continue;
    }

    if (b === 0x25) {
      // % comment - to end of line
      while (i < n && bytes[i] !== 0x0a && bytes[i] !== 0x0d) i++;
      continue;
    }

    if (b === 0x2f) {
      // /Name
      const start = i;
      i++;
      while (i < n && isRegular(bytes[i])) i++;
      tokens.push({ type: "name", start, end: i, text: new TextDecoder("latin1").decode(bytes.subarray(start + 1, i)) });
      continue;
    }

    if (b === 0x28) {
      // (literal string) - balanced parens, backslash escapes
      const start = i;
      i++;
      let depth = 1;
      const out: number[] = [];
      while (i < n && depth > 0) {
        const c = bytes[i];
        if (c === 0x5c) {
          // backslash escape
          i++;
          if (i >= n) break;
          const e = bytes[i];
          if (e === 0x6e) out.push(0x0a);
          else if (e === 0x72) out.push(0x0d);
          else if (e === 0x74) out.push(0x09);
          else if (e === 0x62) out.push(0x08);
          else if (e === 0x66) out.push(0x0c);
          else if (e === 0x28) out.push(0x28);
          else if (e === 0x29) out.push(0x29);
          else if (e === 0x5c) out.push(0x5c);
          else if (e >= 0x30 && e <= 0x37) {
            // up to 3 octal digits
            let val = e - 0x30;
            let count = 1;
            while (count < 3 && i + 1 < n && bytes[i + 1] >= 0x30 && bytes[i + 1] <= 0x37) {
              i++;
              val = val * 8 + (bytes[i] - 0x30);
              count++;
            }
            out.push(val & 0xff);
          } else if (e === 0x0a) {
            // line continuation - emit nothing
          } else if (e === 0x0d) {
            if (i + 1 < n && bytes[i + 1] === 0x0a) i++;
          } else {
            out.push(e);
          }
          i++;
        } else if (c === 0x28) {
          depth++;
          out.push(c);
          i++;
        } else if (c === 0x29) {
          depth--;
          i++;
          if (depth > 0) out.push(c);
        } else {
          out.push(c);
          i++;
        }
      }
      tokens.push({ type: "str", start, end: i, bytes: Uint8Array.from(out) });
      continue;
    }

    if (b === 0x3c) {
      if (bytes[i + 1] === 0x3c) {
        tokens.push({ type: "dict_start", start: i, end: i + 2 });
        i += 2;
        continue;
      }
      // <hex string>
      const start = i;
      i++;
      const hex: number[] = [];
      while (i < n && bytes[i] !== 0x3e) {
        const h = hexVal(bytes[i]);
        if (h >= 0) hex.push(h);
        i++;
      }
      i++; // consume '>'
      const out: number[] = [];
      for (let k = 0; k < hex.length; k += 2) {
        const hi = hex[k];
        const lo = k + 1 < hex.length ? hex[k + 1] : 0;
        out.push((hi << 4) | lo);
      }
      tokens.push({ type: "str", start, end: i, bytes: Uint8Array.from(out) });
      continue;
    }

    if (b === 0x3e && bytes[i + 1] === 0x3e) {
      tokens.push({ type: "dict_end", start: i, end: i + 2 });
      i += 2;
      continue;
    }

    if (b === 0x5b) {
      tokens.push({ type: "arr_start", start: i, end: i + 1 });
      i++;
      continue;
    }
    if (b === 0x5d) {
      tokens.push({ type: "arr_end", start: i, end: i + 1 });
      i++;
      continue;
    }

    if (b === 0x2b || b === 0x2d || b === 0x2e || (b >= 0x30 && b <= 0x39)) {
      const start = i;
      i++;
      while (i < n && (bytes[i] === 0x2e || bytes[i] === 0x2d || bytes[i] === 0x2b || (bytes[i] >= 0x30 && bytes[i] <= 0x39))) i++;
      const text = new TextDecoder("latin1").decode(bytes.subarray(start, i));
      const num = parseFloat(text);
      tokens.push({ type: "num", start, end: i, num: Number.isFinite(num) ? num : 0 });
      continue;
    }

    // Keyword / operator (includes BI...EI inline images, handled specially)
    const start = i;
    while (i < n && isRegular(bytes[i])) i++;
    if (i === start) {
      // Unrecognized delimiter byte (e.g. stray '{' '}') - skip it.
      i++;
      continue;
    }
    const text = new TextDecoder("latin1").decode(bytes.subarray(start, i));

    if (text === "BI") {
      // Inline image: skip name/value pairs until ID, then skip raw data
      // until an EI preceded and followed by whitespace/EOF.
      let j = i;
      while (j < n) {
        // find "ID"
        if (bytes[j] === 0x49 && bytes[j + 1] === 0x44 && (j === 0 || isWhitespace(bytes[j - 1]))) {
          j += 2;
          break;
        }
        j++;
      }
      j++; // one whitespace byte after ID before binary data
      while (j < n - 1) {
        if (bytes[j] === 0x45 && bytes[j + 1] === 0x49 && isWhitespace(bytes[j - 1]) && (j + 2 >= n || isWhitespace(bytes[j + 2]) || isDelimiter(bytes[j + 2]))) {
          j += 2;
          break;
        }
        j++;
      }
      tokens.push({ type: "op", start, end: j, text: "BI...EI" });
      i = j;
      continue;
    }

    tokens.push({ type: "op", start, end: i, text });
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Matrix helpers (PDF row-vector convention: [x' y' 1] = [x y 1] * M)
// ---------------------------------------------------------------------------
type Mat = [number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];
function multiply(a: Mat, b: Mat): Mat {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

// ---------------------------------------------------------------------------
// Text-showing operator location
// ---------------------------------------------------------------------------

export interface ContentTextOp {
  /** Token index of the first operand (replacement span start). */
  operandStartTokenIndex: number;
  /** Token index of the operator keyword itself (replacement span end,
   *  exclusive of the operator - the operator token is kept as-is unless
   *  explicitly rewritten). */
  opTokenIndex: number;
  operator: "Tj" | "TJ" | "'" | '"';
  byteStart: number;
  byteEnd: number;
  /** Combined CTM x Tm at the moment this operator executes. */
  matrix: Mat;
  /** Shows with the same position ID depend on each other's text advances. */
  positionId: number;
  renderingMode: number;
  hasTextOverride: boolean;
  fontSize: number;
  fontResourceName: string;
  /** Byte span of the *size* operand of the `Tf` operator that set this
   *  op's font/size (e.g. the "24" in "/Helvetica-123 24 Tf") - present
   *  whenever that Tf belongs to the same BT/ET block and precedes no
   *  other Tf for a different run, so auto-shrink can rewrite just this
   *  number in place without touching the font resource name itself. */
  tfSizeTokenSpan: { start: number; end: number } | null;
  /** Best-effort decoded text (WinAnsi-ish single-byte assumption), used
   *  only for matching/disambiguation - never for correctness-critical
   *  encoding decisions. */
  decodedText: string;
}

function decodeWinAnsiish(bytes: Uint8Array): string {
  // WinAnsi uses Windows-1252 for common Latin letters and punctuation.
  // The page editor also checks the selected PDF.js text before removal.
  return new TextDecoder("windows-1252").decode(bytes);
}

/** Walks a tokenized content stream tracking just enough graphics/text
 *  state (q/Q + cm stack, BT/ET, Tf, Tm/Td/TD/T*) to compute each
 *  text-showing operator's effective position and font - the same
 *  information pdfjs's `getTextContent()` exposes per run, so the two can
 *  be matched against each other. */
export function locateTextOperators(tokens: Token[]): ContentTextOp[] {
  const ops: ContentTextOp[] = [];
  const graphicsStack: { ctm: Mat; fontSize: number; fontResourceName: string; tfSizeTokenSpan: ContentTextOp["tfSizeTokenSpan"]; leading: number; renderingMode: number }[] = [];
  let ctm: Mat = IDENTITY;
  // Tj/TJ advance the text matrix, but leave the line matrix untouched.
  // We know the origin exactly after a line-positioning operator. Consecutive
  // shows without a new origin share positionId and stay on the fallback.
  let lineMatrix: Mat = IDENTITY;
  let positionId = 0, leading = 0, renderingMode = 0;
  const markedText: boolean[] = [];
  const moveLine = (x: number, y: number) => {
    lineMatrix = multiply([1, 0, 0, 1, x, y], lineMatrix);
    positionId++;
  };
  let fontSize = 0;
  let fontResourceName = "";
  let tfSizeTokenSpan: { start: number; end: number } | null = null;
  const operandStack: number[] = []; // indices into tokens[]

  for (let ti = 0; ti < tokens.length; ti++) {
    const t = tokens[ti];
    if (t.type === "op") {
      const args = operandStack.splice(0, operandStack.length);
      const getNum = (idxFromEnd: number): number => {
        const tok = tokens[args[args.length - idxFromEnd]];
        return tok?.type === "num" ? (tok.num ?? 0) : 0;
      };

      switch (t.text) {
        case "BMC":
          markedText.push(markedText.at(-1) ?? false);
          break;
        case "BDC":
          markedText.push(!!markedText.at(-1) || tokens[ti - 1]?.type === "name"
            || args.some(i => tokens[i].type === "name" && tokens[i].text === "ActualText"));
          break;
        case "EMC":
          markedText.pop();
          break;
        case "q":
          graphicsStack.push({ ctm, fontSize, fontResourceName, tfSizeTokenSpan, leading, renderingMode });
          break;
        case "Q": {
          const saved = graphicsStack.pop();
          if (saved) ({ ctm, fontSize, fontResourceName, tfSizeTokenSpan, leading, renderingMode } = saved);
          break;
        }
        case "cm": {
          if (args.length >= 6) {
            const m: Mat = [getNum(6), getNum(5), getNum(4), getNum(3), getNum(2), getNum(1)];
            ctm = multiply(m, ctm);
          }
          break;
        }
        case "BT":
          lineMatrix = IDENTITY;
          positionId++;
          break;
        case "ET":
          break;
        case "Tf": {
          const nameTok = args.length >= 2 ? tokens[args[args.length - 2]] : undefined;
          fontResourceName = nameTok?.type === "name" ? (nameTok.text ?? "") : fontResourceName;
          fontSize = getNum(1);
          const sizeTokIdx = args.length >= 1 ? args[args.length - 1] : undefined;
          const sizeTok = sizeTokIdx !== undefined ? tokens[sizeTokIdx] : undefined;
          tfSizeTokenSpan = sizeTok?.type === "num" ? { start: sizeTok.start, end: sizeTok.end } : null;
          break;
        }
        case "Tm": {
          if (args.length >= 6) {
            lineMatrix = [getNum(6), getNum(5), getNum(4), getNum(3), getNum(2), getNum(1)];
            positionId++;
          }
          break;
        }
        case "Td":
        case "TD": {
          if (args.length >= 2) {
            if (t.text === "TD") leading = -getNum(1);
            moveLine(getNum(2), getNum(1));
          }
          break;
        }
        case "TL":
          leading = getNum(1);
          break;
        case "Tr":
          renderingMode = getNum(1);
          break;
        case "T*":
          moveLine(0, -leading);
          break;
        case "Tj":
        case "'":
        case '"': {
          if (t.text !== "Tj") moveLine(0, -leading);
          const strIdx = args[args.length - 1];
          const strTok = tokens[strIdx];
          if (strTok?.type === "str") {
            ops.push({
              operandStartTokenIndex: strIdx,
              opTokenIndex: ti,
              operator: t.text as "Tj" | "'" | '"',
              byteStart: strTok.start,
              byteEnd: t.end,
              matrix: multiply(lineMatrix, ctm),
              positionId, renderingMode, hasTextOverride: !!markedText.at(-1),
              fontSize,
              fontResourceName,
              tfSizeTokenSpan,
              decodedText: decodeWinAnsiish(strTok.bytes ?? new Uint8Array()),
            });
          }
          break;
        }
        case "TJ": {
          const arrIdx = args[args.length - 1];
          if (tokens[arrIdx]?.type === "arr_end") {
            // walk backward to matching arr_start
            let depth = 1;
            let k = arrIdx - 1;
            while (k >= 0 && depth > 0) {
              if (tokens[k].type === "arr_end") depth++;
              else if (tokens[k].type === "arr_start") depth--;
              if (depth > 0) k--;
            }
            const arrStart = k;
            if (arrStart < 0) break;
            const parts: string[] = [];
            for (let j = arrStart + 1; j < arrIdx; j++) {
              if (tokens[j].type === "str") parts.push(decodeWinAnsiish(tokens[j].bytes ?? new Uint8Array()));
            }
            ops.push({
              operandStartTokenIndex: arrStart,
              opTokenIndex: ti,
              operator: "TJ",
              byteStart: tokens[arrStart].start,
              byteEnd: t.end,
              matrix: multiply(lineMatrix, ctm),
              positionId, renderingMode, hasTextOverride: !!markedText.at(-1),
              fontSize,
              fontResourceName,
              tfSizeTokenSpan,
              decodedText: parts.join(""),
            });
          }
          break;
        }
        default:
          break;
      }
      continue;
    }
    if (t.type === "num" || t.type === "str" || t.type === "name" || t.type === "arr_end") {
      operandStack.push(ti);
    }
    // arr_start/dict_start/dict_end don't need to be tracked as operands
    // themselves for this limited interpreter's purposes.
  }

  return ops;
}

/** WinAnsiEncoding is a strict superset of printable ASCII for 0x20-0x7E,
 *  which covers every character this feature is required to round-trip.
 *  Anything outside that range falls back to a best-effort latin1 byte,
 *  which is wrong for true WinAnsi high-byte glyphs but never silently
 *  corrupts the common case, and callers should prefer the fallback path
 *  when `hasUnsupportedChars` is true. */
export function encodeWinAnsiish(text: string): { bytes: Uint8Array; hasUnsupportedChars: boolean } {
  const bytes = new Uint8Array(text.length);
  let hasUnsupportedChars = false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0xff) {
      hasUnsupportedChars = true;
      bytes[i] = 0x3f; // '?'
    } else {
      bytes[i] = code;
    }
  }
  return { bytes, hasUnsupportedChars };
}

// ---------------------------------------------------------------------------
// Auto-layout: expand -> shrink -> wrap hierarchy for long replacement text,
// so a replacement never silently clips. Parameterized by a `measureWidth`
// callback so the exact same decision logic runs both live in the browser
// (approximate, via Canvas measureText - fast enough to run on every
// keystroke) and at export time (exact, via the real embedded pdf-lib
// font's `widthOfTextAtSize`, which is what actually determines the final
// rendered result) - the two are architecturally the same algorithm, not
// two different implementations that could drift apart, even though the
// underlying width numbers they're fed necessarily come from two different
// measurement sources (a live DOM canvas vs. the real font metrics).
// ---------------------------------------------------------------------------

export interface AutoLayoutResult {
  lines: string[];
  fontSizePt: number;
  /** Natural width in pt of the widest line at the returned font size -
   *  the caller uses this to grow the on-screen/exported box. */
  widthPt: number;
  heightPt: number;
}

const AUTO_LAYOUT_MIN_FONT_RATIO = 0.6;
const AUTO_LAYOUT_MAX_LINES = 8;
const AUTO_LAYOUT_LINE_HEIGHT_RATIO = 1.15;

function wrapAtWidth(text: string, fontSizePt: number, maxWidthPt: number, measureWidth: (text: string, fontSizePt: number) => number): string[] {
  const words = text.split(/(\s+)/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current + word;
    if (current !== "" && measureWidth(candidate.trim(), fontSizePt) > maxWidthPt) {
      lines.push(current.trim());
      current = word.trimStart();
    } else {
      current = candidate;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.length > 0 ? lines : [""];
}

/**
 * Hierarchy (matches the product requirement exactly):
 *  1. If the text fits on one line within `availableWidthPt` at the
 *     original font size, use it as-is (box grows to the natural width,
 *     never clips).
 *  2. Otherwise, try wrapping to multiple lines at the original font size
 *     within `availableWidthPt`.
 *  3. If that would need more than `AUTO_LAYOUT_MAX_LINES` lines, shrink
 *     the font size in small steps (down to `AUTO_LAYOUT_MIN_FONT_RATIO`
 *     of the original) and re-wrap at each step, keeping the largest size
 *     that fits within the line cap.
 *  4. Whatever the loop lands on (even if still over the cap at the
 *     floor size) is returned - it will wrap to more lines rather than
 *     ever clipping a character.
 */
export function computeAutoTextLayout(
  text: string,
  originalFontSizePt: number,
  availableWidthPt: number,
  measureWidth: (text: string, fontSizePt: number) => number
): AutoLayoutResult {
  const singleLineWidth = measureWidth(text, originalFontSizePt);
  if (singleLineWidth <= availableWidthPt) {
    return { lines: [text], fontSizePt: originalFontSizePt, widthPt: singleLineWidth, heightPt: originalFontSizePt * AUTO_LAYOUT_LINE_HEIGHT_RATIO };
  }

  let bestLines = wrapAtWidth(text, originalFontSizePt, availableWidthPt, measureWidth);
  let bestSize = originalFontSizePt;

  if (bestLines.length > AUTO_LAYOUT_MAX_LINES) {
    const floor = originalFontSizePt * AUTO_LAYOUT_MIN_FONT_RATIO;
    for (let size = originalFontSizePt * 0.9; size >= floor; size -= originalFontSizePt * 0.1) {
      const lines = wrapAtWidth(text, size, availableWidthPt, measureWidth);
      bestLines = lines;
      bestSize = size;
      if (lines.length <= AUTO_LAYOUT_MAX_LINES) break;
    }
  }

  const widthPt = Math.max(...bestLines.map((l) => measureWidth(l, bestSize)));
  return { lines: bestLines, fontSizePt: bestSize, widthPt, heightPt: bestLines.length * bestSize * AUTO_LAYOUT_LINE_HEIGHT_RATIO };
}

function bytesToHexToken(bytes: Uint8Array): string {
  let out = "<";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out + ">";
}

export interface ContentReplacement {
  op: ContentTextOp;
  /** One entry per output line (multi-line replacements emit one Tj per
   *  line joined by an explicit text-position move, so line spacing is
   *  exact rather than relying on a possibly-untracked TL/leading). */
  lines: string[];
  lineHeightPt: number;
  fontSizePt: number;
  /** Set when auto-fit shrank the font size for this run - rewrites the
   *  originating Tf operator's size operand in place so the exported PDF
   *  actually draws at the reduced size (Tj/TJ carry no size of their
   *  own; only Tf does). */
  newFontSizeForTf?: number;
}

/** Builds the replacement byte sequence for one text op: a single line
 *  becomes `<hex> Tj`; multiple lines become `<hex> Tj dx dy Td <hex> Tj
 *  ...` so each subsequent line is explicitly positioned relative to the
 *  first (dx=0 to keep left alignment at the run's own start x, dy is a
 *  negative offset by one line height) - self-contained and independent
 *  of any TL/leading state the surrounding stream may or may not set. */
function buildReplacementBytes(lines: string[], lineHeightPt: number): Uint8Array {
  const encoder = new TextEncoder();
  const parts: number[] = [];
  const pushStr = (s: string) => {
    for (const c of encoder.encode(s)) parts.push(c);
  };
  lines.forEach((line, i) => {
    const { bytes } = encodeWinAnsiish(line);
    if (i > 0) pushStr(` 0 ${-lineHeightPt} Td `);
    pushStr(bytesToHexToken(bytes));
    pushStr(" Tj");
  });
  return Uint8Array.from(parts);
}

interface ByteSpanReplacement {
  start: number;
  end: number;
  bytes: Uint8Array;
}

/** Applies a flat list of byte-span replacements to a buffer, splicing in
 *  reverse byte order so earlier offsets stay valid as later ones are
 *  processed. Spans must not overlap. */
function spliceReplacements(bytes: Uint8Array, spans: ByteSpanReplacement[]): Uint8Array {
  const sorted = [...spans].sort((a, b) => b.start - a.start);
  let out = bytes;
  for (const span of sorted) {
    const before = out.subarray(0, span.start);
    const after = out.subarray(span.end);
    const next = new Uint8Array(before.length + span.bytes.length + after.length);
    next.set(before, 0);
    next.set(span.bytes, before.length);
    next.set(after, before.length + span.bytes.length);
    out = next;
  }
  return out;
}

/** Applies a set of text-op replacements (and any accompanying Tf
 *  font-size rewrites) to a content stream's bytes in one pass. */
export function applyContentReplacements(bytes: Uint8Array, replacements: ContentReplacement[]): Uint8Array {
  const encoder = new TextEncoder();
  const spans: ByteSpanReplacement[] = [];
  for (const r of replacements) {
    spans.push({ start: r.op.byteStart, end: r.op.byteEnd, bytes: buildReplacementBytes(r.lines, r.lineHeightPt) });
    if (r.newFontSizeForTf !== undefined && r.op.tfSizeTokenSpan) {
      spans.push({
        start: r.op.tfSizeTokenSpan.start,
        end: r.op.tfSizeTokenSpan.end,
        bytes: encoder.encode(String(Math.round(r.newFontSizeForTf * 100) / 100)),
      });
    }
  }
  return spliceReplacements(bytes, spans);
}

// ---------------------------------------------------------------------------
// Page-level orchestration: decode a page's real content stream(s), locate
// every text-showing operator, match against the caller's extracted-run
// edits (position + font-size + text proximity - the same identifying
// information `extractPageTextRuns` captured from pdfjs), and either
// perform a genuine in-place replacement or report the edit as unsupported
// (composite/Type0 font, or no confident match) so the caller can fall
// back to cover-and-redraw for exactly that edit.
// ---------------------------------------------------------------------------

export interface PageTextEditRequest {
  id: string;
  /** PDF-point coordinates/size as captured at extraction time (see
   *  `TextEdit` in pdf-forms-engine.ts) - the same space this module's
   *  `matrix[4]/matrix[5]` (translation) and `fontSize` are computed in. */
  originalXPt: number;
  originalYPt: number;
  fontSizePt: number;
  originalText: string;
  newText: string;
  /** User's manual box-resize width in pt, if they dragged the replacement
   *  box; when unset, available width is derived from the page's own
   *  right edge (auto-grow). Either way this module runs the same
   *  expand/shrink/wrap hierarchy - a manual width just changes the
   *  constraint it wraps within. */
  manualWidthPt?: number;
}

export interface PageTextEditResult {
  applied: Set<string>;
  unsupportedReason: Map<string, string>;
  /** The actual layout used for each applied edit, so the caller can
   *  reconcile the live editor's approximate preview with what was
   *  genuinely exported (font size actually used, line count, etc). */
  layouts: Map<string, AutoLayoutResult>;
}

const STANDARD_FONT_BY_BASEFONT: Record<string, string> = {
  Helvetica: "Helvetica",
  "Helvetica-Bold": "HelveticaBold",
  "Helvetica-Oblique": "HelveticaOblique",
  "Helvetica-BoldOblique": "HelveticaBoldOblique",
  "Times-Roman": "TimesRoman",
  "Times-Bold": "TimesRomanBold",
  "Times-Italic": "TimesRomanItalic",
  "Times-BoldItalic": "TimesRomanBoldItalic",
  Courier: "Courier",
  "Courier-Bold": "CourierBold",
  "Courier-Oblique": "CourierOblique",
  "Courier-BoldOblique": "CourierBoldOblique",
  ArialMT: "Helvetica",
  "Arial-BoldMT": "HelveticaBold",
};

async function resolveWidthMeasurer(
  pdfDoc: import("pdf-lib").PDFDocument,
  page: import("pdf-lib").PDFPage,
  resourceName: string
): Promise<(text: string, fontSizePt: number) => number> {
  const { PDFName, PDFDict, StandardFonts } = await import("pdf-lib");
  let baseFontName = "Helvetica";
  const res = page.node.Resources();
  const fontsDict = res?.lookup(PDFName.of("Font"));
  if (fontsDict instanceof PDFDict) {
    const fontRef = fontsDict.get(PDFName.of(resourceName));
    const fontDict = pdfDoc.context.lookup(fontRef);
    if (fontDict instanceof PDFDict) {
      const bf = fontDict.get(PDFName.of("BaseFont"))?.toString().replace(/^\//, "");
      if (bf) baseFontName = bf.includes("+") ? bf.split("+")[1] : bf;
    }
  }
  const standardKey = STANDARD_FONT_BY_BASEFONT[baseFontName] ?? "Helvetica";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- StandardFonts is an enum-like object keyed by these exact names
  const font = await pdfDoc.embedFont((StandardFonts as any)[standardKey] ?? StandardFonts.Helvetica);
  return (text: string, fontSizePt: number) => font.widthOfTextAtSize(text, fontSizePt);
}

async function getPageContentBytes(pdfDoc: import("pdf-lib").PDFDocument, page: import("pdf-lib").PDFPage): Promise<{ bytes: Uint8Array; segments: number[] }> {
  const { PDFName, PDFArray, PDFRawStream, decodePDFRawStream } = await import("pdf-lib");
  const contentsEntry = page.node.get(PDFName.of("Contents"));
  const resolved = pdfDoc.context.lookup(contentsEntry);
  const streams = resolved instanceof PDFArray ? Array.from({ length: resolved.size() }, (_, i) => pdfDoc.context.lookup(resolved.get(i))) : [resolved];

  const chunks: Uint8Array[] = [];
  const segments: number[] = [0];
  for (const s of streams) {
    if (s instanceof PDFRawStream) {
      const decoded = decodePDFRawStream(s).decode();
      chunks.push(decoded, new Uint8Array([0x0a]));
      segments.push(segments[segments.length - 1] + decoded.length + 1);
    }
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return { bytes, segments };
}

async function isSimpleFont(pdfDoc: import("pdf-lib").PDFDocument, page: import("pdf-lib").PDFPage, resourceName: string): Promise<boolean> {
  const { PDFName, PDFDict } = await import("pdf-lib");
  if (!resourceName) return false;
  const res = page.node.Resources();
  const fontsDict = res?.lookup(PDFName.of("Font"));
  if (!(fontsDict instanceof PDFDict)) return false;
  const fontRef = fontsDict.get(PDFName.of(resourceName));
  const fontDict = pdfDoc.context.lookup(fontRef);
  if (!(fontDict instanceof PDFDict)) return false;
  const subtype = fontDict.get(PDFName.of("Subtype"))?.toString();
  return subtype === "/Type1" || subtype === "/TrueType" || subtype === "/MMType1";
}

const POSITION_TOLERANCE_PT = 3;
const FONT_SIZE_TOLERANCE_PT = 1.5;

/** Applies genuine content-stream replacement for as many of the given
 *  edits as can be confidently and safely located on this page; returns
 *  which ids succeeded so the caller can run cover-and-redraw for the
 *  rest (and only the rest). */
export async function replacePageTextInPlace(
  pdfDoc: import("pdf-lib").PDFDocument,
  page: import("pdf-lib").PDFPage,
  edits: PageTextEditRequest[]
): Promise<PageTextEditResult> {
  const applied = new Set<string>();
  const unsupportedReason = new Map<string, string>();
  const layouts = new Map<string, AutoLayoutResult>();
  const touched = edits.filter((e) => e.newText !== e.originalText);
  if (touched.length === 0) return { applied, unsupportedReason, layouts };

  const { bytes } = await getPageContentBytes(pdfDoc, page);
  const tokens = tokenizeContentStream(bytes);
  const textOps = locateTextOperators(tokens);

  const usedOps = new Set<number>();
  const matches: { edit: PageTextEditRequest; op: ContentTextOp }[] = [];

  for (const edit of touched) {
    let best: ContentTextOp | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < textOps.length; i++) {
      if (usedOps.has(i)) continue;
      const op = textOps[i];
      const dx = Math.abs(op.matrix[4] - edit.originalXPt);
      const dy = Math.abs(op.matrix[5] - edit.originalYPt);
      const dSize = Math.abs(op.fontSize - edit.fontSizePt);
      if (dx > POSITION_TOLERANCE_PT || dy > POSITION_TOLERANCE_PT || dSize > FONT_SIZE_TOLERANCE_PT) continue;
      const textMatches = op.decodedText.trim() === edit.originalText.trim();
      const score = dx + dy + dSize + (textMatches ? 0 : 10);
      if (score < bestScore) {
        bestScore = score;
        best = op;
      }
    }
    if (best) {
      const idx = textOps.indexOf(best);
      usedOps.add(idx);
      matches.push({ edit, op: best });
    } else {
      unsupportedReason.set(edit.id, "No matching text operator found at export time (page content changed or run not individually addressable).");
    }
  }

  const { width: pageWidthPt } = page.getSize();
  const PAGE_RIGHT_MARGIN_PT = 24;

  const replacements: ContentReplacement[] = [];
  for (const { edit, op } of matches) {
    if (!(await isSimpleFont(pdfDoc, page, op.fontResourceName))) {
      unsupportedReason.set(edit.id, "Original font is a composite/CID font (Type0) - its embedded glyph subset cannot safely represent arbitrary new text, so this run falls back to cover-and-redraw.");
      continue;
    }
    const { hasUnsupportedChars } = encodeWinAnsiish(edit.newText);
    if (hasUnsupportedChars) {
      unsupportedReason.set(edit.id, "New text contains characters outside WinAnsiEncoding's single-byte range for this font - falls back to cover-and-redraw for those characters.");
      continue;
    }

    const measureWidth = await resolveWidthMeasurer(pdfDoc, page, op.fontResourceName);
    const availableWidthPt = edit.manualWidthPt ?? Math.max(20, pageWidthPt - PAGE_RIGHT_MARGIN_PT - op.matrix[4]);
    const layout = computeAutoTextLayout(edit.newText, edit.fontSizePt, availableWidthPt, measureWidth);
    layouts.set(edit.id, layout);

    replacements.push({
      op,
      lines: layout.lines,
      lineHeightPt: layout.fontSizePt * AUTO_LAYOUT_LINE_HEIGHT_RATIO,
      fontSizePt: layout.fontSizePt,
      newFontSizeForTf: layout.fontSizePt !== edit.fontSizePt ? layout.fontSizePt : undefined,
    });
    applied.add(edit.id);
  }

  if (replacements.length === 0) return { applied, unsupportedReason, layouts };

  const newBytes = applyContentReplacements(bytes, replacements);
  const { PDFName, PDFRawStream } = await import("pdf-lib");
  const context = pdfDoc.context;
  const newStreamDict = context.obj({ Length: newBytes.length });
  const newStream = PDFRawStream.of(newStreamDict, newBytes);
  const newRef = context.register(newStream);
  page.node.set(PDFName.of("Contents"), context.obj([newRef]));

  return { applied, unsupportedReason, layouts };
}

/** Recognize only the bounded, balanced vector/text groups authored by our
 * Unicode editor. Unknown versions, nested marked content, clipping and other
 * drawing operators remain on the existing rendered-page fallback. */
function authoredTextGroups(tokens: Token[], ops: ContentTextOp[]) {
  const groups: { text: string; op: ContentTextOp; start: number; end: number }[] = [];
  const allowed = new Set(["q", "Q", "rg", "gs", "cm", "Do", "BT", "Tr", "Tf", "Tz", "Tm", "Tj", "ET"]);
  let nextOp = 0;
  for (let i = 7; i < tokens.length; i++) {
    if (tokens[i].type !== "op" || tokens[i].text !== "BDC") continue;
    const marker = tokens.slice(i - 7, i);
    if (marker[0].type !== "name" || marker[0].text !== "PDFPilotText"
      || marker[1].type !== "dict_start" || marker[2].text !== "V" || marker[3].num !== 1
      || marker[4].text !== "Text" || marker[5].type !== "str" || marker[6].type !== "dict_end") continue;
    const encoded = marker[5].bytes;
    if (!encoded || encoded.length < 2 || encoded.length % 2 || encoded[0] !== 0xfe || encoded[1] !== 0xff) continue;
    let end = i + 1, depth = 0, textDepth = 0, valid = true, invisible = false;
    for (; end < tokens.length; end++) {
      const token = tokens[end];
      if (token.type !== "op") continue;
      if (token.text === "EMC") break;
      if (!allowed.has(token.text ?? "")) { valid = false; break; }
      if (token.text === "q") depth++;
      if (token.text === "Q" && --depth < 0) { valid = false; break; }
      if (token.text === "BT" && ++textDepth !== 1) { valid = false; break; }
      if (token.text === "ET" && --textDepth !== 0) { valid = false; break; }
      if (token.text === "Tr") {
        if (tokens[end - 1]?.num !== 3) { valid = false; break; }
        invisible = true;
      }
    }
    if (!valid || !invisible || depth !== 0 || textDepth !== 0 || end === tokens.length) continue;
    while (nextOp < ops.length && ops[nextOp].opTokenIndex <= i) nextOp++;
    const showing = ops[nextOp];
    if (!showing || showing.opTokenIndex >= end || showing.operator !== "Tj" || (ops[nextOp + 1]?.opTokenIndex ?? Infinity) < end) continue;
    groups.push({ text: new TextDecoder("utf-16be").decode(encoded.subarray(2)).trim(), op: showing, start: marker[0].start, end: tokens[end].end });
    i = end;
  }
  return groups;
}

/** Remove independently addressable text runs before the editor draws their
 * replacements. Fail atomically for complex text objects so callers can render
 * a clean page instead of leaving the original text underneath an overlay.
 * A run can be removed when its origin and the next run's origin are independently
 * positioned. Several separately positioned lines may share one BT/ET block. */
export async function removeIndependentPageText(
  pdfDoc: import("pdf-lib").PDFDocument,
  page: import("pdf-lib").PDFPage,
  edits: { originalXPt: number; originalYPt: number; originalText: string }[]
): Promise<boolean> {
  if (!edits.length) return true;
  const { PDFName, PDFDict, PDFRawStream, decodePDFRawStream } = await import("pdf-lib");
  const { bytes } = await getPageContentBytes(pdfDoc, page);
  const tokens = tokenizeContentStream(bytes);
  // Text used as a clipping path affects later graphics. Inline-image bytes
  // also require a full PDF parser; use the rendered fallback for either.
  let inText = false;
  for (const [i, token] of tokens.entries()) {
    if (token.type !== "op") continue;
    if (token.text === "BI...EI" || (token.text === "Tr" && (tokens[i - 1]?.num ?? 0) >= 4)) return false;
    if (token.text === "BT" || token.text === "ET") {
      if (inText === (token.text === "BT")) return false;
      inText = token.text === "BT";
    } else if (!inText && ["Tj", "TJ", "'", '"'].includes(token.text ?? "")) return false;
  }
  if (inText) return false;
  const ops = locateTextOperators(tokens);
  const independent = new Set(ops.filter((op, i) => !op.hasTextOverride && op.renderingMode >= 0 && op.renderingMode < 3
    && op.positionId !== ops[i - 1]?.positionId && op.positionId !== ops[i + 1]?.positionId));
  const authored = authoredTextGroups(tokens, ops);
  const fontResources = page.node.Resources()?.lookup(PDFName.of("Font"));
  const cidMaps = new Map<string, Map<number, string> | null>();
  const sourceText = (op: ContentTextOp): string | null => {
    if (!(fontResources instanceof PDFDict)) return null;
    const font = pdfDoc.context.lookup(fontResources.get(PDFName.of(op.fontResourceName)));
    if (!(font instanceof PDFDict)) return null;
    const subtype = font.get(PDFName.of("Subtype"))?.toString(), encoding = font.get(PDFName.of("Encoding"))?.toString();
    if (subtype === "/Type0" && encoding === "/Identity-H") {
      if (!cidMaps.has(op.fontResourceName)) {
        const cmap = font.lookup(PDFName.of("ToUnicode"));
        let mapping = null;
        if (cmap instanceof PDFRawStream && !cmap.dict.has(PDFName.of("UseCMap"))) {
          const limit = 1024 * 1024;
          const decoded = decodePDFRawStream(cmap).getBytes(limit + 1);
          if (decoded.length <= limit) mapping = readIdentityUnicodeMap(tokenizeContentStream(new Uint8Array(decoded)));
        }
        cidMaps.set(op.fontResourceName, mapping);
      }
      const mapping = cidMaps.get(op.fontResourceName);
      if (!mapping) return null;
      let result = "";
      for (let i = op.operandStartTokenIndex; i < op.opTokenIndex; i++) {
        const bytes = tokens[i].bytes;
        if (!bytes) continue;
        if (bytes.length % 2) return null;
        for (let j = 0; j < bytes.length; j += 2) {
          const value = mapping.get(bytes[j] * 256 + bytes[j + 1]);
          if (value === undefined) return null;
          result += value;
        }
      }
      return result;
    }
    if (subtype !== "/Type1" && subtype !== "/TrueType") return null;
    const base = font.get(PDFName.of("BaseFont"))?.toString().slice(1) ?? "";
    if (encoding === "/WinAnsiEncoding") return op.decodedText;
    const standardLatin = /^(Helvetica|Courier)(-Bold|-Oblique|-BoldOblique)?$|^Times-(Roman|Bold|Italic|BoldItalic)$/.test(base);
    return encoding === undefined && standardLatin && /^[\x20-\x7e]+$/.test(op.decodedText) ? op.decodedText : null;
  };
  const used = new Set<number>();
  const spans: ByteSpanReplacement[] = [];
  for (const edit of edits) {
    const matchingGroups = authored.filter(group => !group.op.hasTextOverride && !used.has(group.op.opTokenIndex)
      && group.text === edit.originalText.trim()
      && Math.abs(group.op.matrix[4] - edit.originalXPt) < 0.5
      && Math.abs(group.op.matrix[5] - edit.originalYPt) < 0.5);
    if (matchingGroups.length > 1) return false;
    if (matchingGroups.length === 1) {
      const group = matchingGroups[0];
      used.add(group.op.opTokenIndex);
      spans.push({ start: group.start, end: group.end, bytes: new Uint8Array() });
      continue;
    }
    const candidates = ops.filter(op => !used.has(op.opTokenIndex)
      && Math.abs(op.matrix[4] - edit.originalXPt) < 0.5
      && Math.abs(op.matrix[5] - edit.originalYPt) < 0.5
      && sourceText(op) === edit.originalText);
    if (candidates.length !== 1 || !independent.has(candidates[0])) return false;
    const op = candidates[0];
    used.add(op.opTokenIndex);
    // Keep the original operator. Quote operators also advance the line or
    // change word/character spacing, and following text depends on that state.
    const empty = op.operator === "TJ" ? "[] TJ" : `<> ${op.operator}`;
    spans.push({ start: op.byteStart, end: op.byteEnd, bytes: new TextEncoder().encode(empty) });
  }
  const changed = spliceReplacements(bytes, spans);
  const stream = PDFRawStream.of(pdfDoc.context.obj({ Length: changed.length }), changed);
  page.node.set(PDFName.of("Contents"), pdfDoc.context.obj([pdfDoc.context.register(stream)]));
  return true;
}
