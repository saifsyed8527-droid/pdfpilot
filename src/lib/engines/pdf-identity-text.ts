import type { tokenizeContentStream } from "./pdf-content-text";

/** Read the two-byte ToUnicode mappings used with Identity-H. Unsupported
 * code spaces, inherited maps or ambiguous entries fall back to rendering. */
export function readIdentityUnicodeMap(tokens: ReturnType<typeof tokenizeContentStream>) {
  const mappings = new Map<number, string>();
  const decoder = new TextDecoder("utf-16be", { fatal: true, ignoreBOM: true });
  const code = (index: number) => {
    const bytes = tokens[index]?.bytes;
    return bytes?.length === 2 ? bytes[0] * 256 + bytes[1] : -1;
  };
  const put = (key: number, bytes?: Uint8Array) => {
    if (!bytes?.length || bytes.length > 256 || bytes.length % 2 || mappings.has(key)) return false;
    try { mappings.set(key, decoder.decode(bytes)); }
    catch { return false; }
    return true;
  };
  let hasCodespace = false;
  for (let i = 0; i < tokens.length; i++) {
    const op = tokens[i].text;
    if (op === "usecmap" || op === "begincidchar" || op === "begincidrange" || op === "beginnotdefrange" || op === "beginnotdefchar") return null;
    if (op === "begincodespacerange") {
      if (hasCodespace || tokens[i - 1]?.num !== 1 || code(i + 1) !== 0 || code(i + 2) !== 65535 || tokens[i + 3]?.text !== "endcodespacerange") return null;
      hasCodespace = true;
      i += 3;
      continue;
    }
    if (op !== "beginbfchar" && op !== "beginbfrange") continue;
    const count = tokens[i - 1]?.num;
    if (count === undefined || !Number.isInteger(count) || count < 1 || count > 65536) return null;
    for (let n = 0; n < count; n++) {
      const first = code(++i);
      if (first < 0) return null;
      if (op === "beginbfchar") {
        if (!put(first, tokens[++i]?.bytes)) return null;
        continue;
      }
      const last = code(++i), dest = tokens[++i];
      if (last < first || !dest) return null;
      if (dest.type === "arr_start") {
        for (let cid = first; cid <= last; cid++) if (!put(cid, tokens[++i]?.bytes)) return null;
        if (tokens[++i]?.type !== "arr_end") return null;
      } else {
        // PDF 32000-1 9.10.3 increments the last byte without carrying.
        const value = dest.bytes?.slice();
        if (!value?.length || value[value.length - 1] + last - first > 255) return null;
        for (let cid = first; cid <= last; cid++) {
          if (!put(cid, value)) return null;
          value[value.length - 1]++;
        }
      }
    }
    if (tokens[++i]?.text !== (op === "beginbfchar" ? "endbfchar" : "endbfrange")) return null;
  }
  return hasCodespace && mappings.size ? mappings : null;
}
