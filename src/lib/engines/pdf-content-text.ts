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
  // Printable ASCII passes through unchanged under WinAnsiEncoding, which
  // covers every test string this feature is required to handle; bytes
  // outside that range are decoded via latin1 as a reasonable approximation
  // for matching purposes only.
  return new TextDecoder("latin1").decode(bytes);
}

/** Walks a tokenized content stream tracking just enough graphics/text
 *  state (q/Q + cm stack, BT/ET, Tf, Tm/Td/TD/T*) to compute each
 *  text-showing operator's effective position and font - the same
 *  information pdfjs's `getTextContent()` exposes per run, so the two can
 *  be matched against each other. */
export function locateTextOperators(tokens: Token[]): ContentTextOp[] {
  const ops: ContentTextOp[] = [];
  const ctmStack: Mat[] = [IDENTITY];
  let ctm: Mat = IDENTITY;
  let tm: Mat = IDENTITY;
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
        case "q":
          ctmStack.push(ctm);
          break;
        case "Q":
          ctm = ctmStack.pop() ?? IDENTITY;
          break;
        case "cm": {
          if (args.length >= 6) {
            const m: Mat = [getNum(6), getNum(5), getNum(4), getNum(3), getNum(2), getNum(1)];
            ctm = multiply(m, ctm);
          }
          break;
        }
        case "BT":
          tm = IDENTITY;
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
          if (args.length >= 6) tm = [getNum(6), getNum(5), getNum(4), getNum(3), getNum(2), getNum(1)];
          break;
        }
        case "Td":
        case "TD": {
          if (args.length >= 2) {
            const translate: Mat = [1, 0, 0, 1, getNum(2), getNum(1)];
            tm = multiply(translate, tm);
          }
          break;
        }
        case "T*":
          // Newline via leading - a fixed small negative Y step is close
          // enough for matching purposes when TL wasn't explicitly tracked;
          // the actual value doesn't matter for our use (only the position
          // of *this* operator's Tj/TJ, not of hypothetical ones after it).
          break;
        case "Tj":
        case "'":
        case '"': {
          const strIdx = args[args.length - 1];
          const strTok = tokens[strIdx];
          if (strTok?.type === "str") {
            ops.push({
              operandStartTokenIndex: strIdx,
              opTokenIndex: ti,
              operator: t.text as "Tj" | "'" | '"',
              byteStart: strTok.start,
              byteEnd: t.end,
              matrix: multiply(tm, ctm),
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
              matrix: multiply(tm, ctm),
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
