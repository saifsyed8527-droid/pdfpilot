// Check ZIP metadata without inflating content before handing Office files to
// parsers. These budgets complement (not replace) parser-specific validation.
export async function checkOfficeArchive(bytes: Uint8Array, requiredPart?: string) {
  if (bytes.byteLength > 100 * 1024 * 1024) throw new Error("This Office file exceeds the 100MB limit.");
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4;
  if (!zip) {
    if (requiredPart) throw new Error("Please choose a valid, unencrypted Office document.");
    return; // Legacy compound XLS is validated by its own parser.
  }
  const { unzipSync } = await import("fflate");
  let count = 0, total = 0;
  const names = new Set<string>();
  unzipSync(bytes, { filter(entry) {
    count++; total += entry.originalSize;
    if (!Number.isSafeInteger(entry.originalSize) || entry.originalSize < 0 ||
        count > 10000 || total > 256 * 1024 * 1024 || entry.originalSize > 64 * 1024 * 1024 ||
        (/\.(xml|rels)$/i.test(entry.name) && entry.originalSize > 12 * 1024 * 1024) ||
        /[\\\x00-\x1f]/.test(entry.name) || entry.name.startsWith("/") ||
        entry.name.split("/").some(part => ["..", "__proto__", "constructor", "prototype"].includes(part)) || names.has(entry.name)) {
      throw new Error("This Office archive is too large or unsafe to unpack. Save a smaller, fresh copy.");
    }
    names.add(entry.name);
    return false;
  }});
  if (requiredPart && !names.has(requiredPart)) throw new Error("This file is not the expected Office document format.");
}
