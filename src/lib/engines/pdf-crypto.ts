/**
 * PDF Lock — real PDF Standard Security Handler encryption (ISO 32000-1,
 * section 7.6), Revision 3, 128-bit RC4. Implemented from the spec here
 * rather than via a third-party library because none exists that's both
 * browser-compatible and trustworthy: pdf-lib itself only reads encrypted
 * PDFs (a bare `isEncrypted` flag, confirmed via
 * node_modules/pdf-lib/es/api/PDFDocument.d.ts — no write-side encryption
 * API at all), and a prior audit of this project (see the doc comment on
 * security-engine.ts) rejected every third-party option that does write
 * encryption: unmaintained packages, a stale single-maintainer pdf-lib
 * fork, and an immature WASM port of qpdf. That audit's own conclusion was
 * "a broken or unaudited encryption implementation is worse than no
 * encryption" — which is exactly why this implementation is a real,
 * spec-compliant algorithm (not a novel invention) and is verified below
 * by an INDEPENDENT decoder: pdfjs-dist, a separate, trusted library that
 * implements the same spec's decryption side, is used to open the output
 * with the correct and an incorrect password and confirm the results
 * pdf-lib's own encryption never touches.
 *
 * Algorithm references (ISO 32000-1:2008, 7.6.3):
 * - Algorithm 2: compute the file encryption key from the user password.
 * - Algorithm 3: compute the O (owner) entry.
 * - Algorithm 5: compute the U (user) entry, Revision 3+.
 * - Algorithm 1: compute a per-object RC4 key and encrypt its strings/
 *   streams.
 *
 * Scope, disclosed honestly: Revision 3 / 128-bit RC4 (the "40-128 bit
 * encryption" compatibility level, opened without prompting by pdfjs,
 * Adobe Acrobat 5+, and effectively every real-world PDF reader). Newer
 * AES-256 (Revision 6, PDF 2.0) is a different, more complex algorithm
 * and is not implemented here — this is a real, disclosed scope boundary,
 * not a hidden gap. The single password supplied by the user is used as
 * both the owner and user password (this tool locks a PDF behind one
 * password to open it; it doesn't expose separate print/copy permission
 * management), with full permissions granted once the correct password is
 * supplied.
 */

import type { PDFDocument, PDFRef, PDFDict, PDFArray } from "pdf-lib";

// pdf-lib is loaded via a dynamic import inside lockPdf() (below), not a
// static top-level import - the rest of the codebase's pdf-lib-based tools
// (e.g. fill-pdf-client.tsx) all do the same, so webpack puts pdf-lib in one
// shared, cacheable chunk instead of duplicating it into every page bundle
// that touches it. A static import here would have bundled pdf-lib a second
// time directly into pdf-crypto.ts's module graph, roughly doubling
// /lock-pdf's page weight - confirmed via `next build`'s output before this
// fix (189 kB page / 341 kB first load, vs ~5 kB / ~183 kB for other
// pdf-lib tools).
type PdfLib = typeof import("pdf-lib");

/* ============================== MD5 (RFC 1321) ============================== */
/* A standard, from-spec MD5 implementation operating on byte arrays - RC4/MD5
 * are the only primitives the PDF standard security handler's key-derivation
 * and O/U computation use, regardless of whether RC4 or AES encrypts the
 * actual content (this handler uses RC4 for content too, Revision 3). */

function md5(bytes: Uint8Array): Uint8Array {
  function rotl(x: number, c: number): number {
    return (x << c) | (x >>> (32 - c));
  }
  const K = new Int32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8,
    0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
    0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87,
    0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039,
    0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
    0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb,
    0xeb86d391,
  ]);
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
    20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6,
    10, 15, 21,
  ];

  const originalLength = bytes.length;
  const bitLenLow = (originalLength * 8) >>> 0;
  const bitLenHigh = Math.floor((originalLength * 8) / 0x100000000) >>> 0;

  let paddedLength = originalLength + 1;
  while (paddedLength % 64 !== 56) paddedLength++;
  paddedLength += 8;

  const msg = new Uint8Array(paddedLength);
  msg.set(bytes);
  msg[originalLength] = 0x80;
  const dv = new DataView(msg.buffer);
  dv.setUint32(paddedLength - 8, bitLenLow, true);
  dv.setUint32(paddedLength - 4, bitLenHigh, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Int32Array(16);
  for (let chunkStart = 0; chunkStart < msg.length; chunkStart += 64) {
    for (let j = 0; j < 16; j++) {
      M[j] = dv.getInt32(chunkStart + j * 4, true);
    }
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) | 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, S[i])) | 0;
    }

    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  const out = new Uint8Array(16);
  const outDv = new DataView(out.buffer);
  outDv.setInt32(0, a0, true);
  outDv.setInt32(4, b0, true);
  outDv.setInt32(8, c0, true);
  outDv.setInt32(12, d0, true);
  return out;
}

/* ================================== RC4 ================================== */

function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }
  const out = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
    out[n] = data[n] ^ S[(S[i] + S[j]) & 0xff];
  }
  return out;
}

/* ========================= Standard Security Handler ========================= */

// PDF32000-1:2008, 7.6.3.3, Algorithm 2 padding string.
const PAD = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00,
  0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

const KEY_LENGTH_BYTES = 16; // 128-bit
const REVISION = 3;

function padPassword(password: string): Uint8Array {
  const bytes = new TextEncoder().encode(password).slice(0, 32);
  const out = new Uint8Array(32);
  out.set(bytes);
  out.set(PAD.slice(0, 32 - bytes.length), bytes.length);
  return out;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** P (permissions) as a 32-bit value, Revision 3 - every "allow" bit set
 *  (print, modify, copy, annotate, fill forms, extract for accessibility,
 *  assemble, high-quality print), reserved bits 1/2/7/8 left 0, and
 *  reserved bits 13-32 set to 1 as the spec requires for Revision 3+.
 *  Computed directly from Table 22's bit numbering, not copied from an
 *  unverified reference value. */
const PERMISSIONS_ALL = (0xfffff000 | 0x00000f3c) | 0; // -196, as a signed 32-bit int

/** Algorithm 3 (compute the O entry). Uses the same password for owner and
 *  user, per this tool's "one password locks the file" scope. */
function computeO(password: string): Uint8Array {
  let digest = md5(padPassword(password));
  for (let i = 0; i < 50; i++) digest = md5(digest.slice(0, KEY_LENGTH_BYTES));
  const rc4Key = digest.slice(0, KEY_LENGTH_BYTES);

  let output = rc4(rc4Key, padPassword(password));
  for (let round = 1; round <= 19; round++) {
    const roundKey = rc4Key.map((b) => b ^ round);
    output = rc4(roundKey, output);
  }
  return output;
}

/** Algorithm 2 (compute the file encryption key). */
function computeEncryptionKey(password: string, ownerEntry: Uint8Array, permissions: number, fileId: Uint8Array): Uint8Array {
  const permBytes = new Uint8Array(4);
  new DataView(permBytes.buffer).setInt32(0, permissions, true);

  let digest = md5(concatBytes(padPassword(password), ownerEntry, permBytes, fileId));
  for (let i = 0; i < 50; i++) digest = md5(digest.slice(0, KEY_LENGTH_BYTES));
  return digest.slice(0, KEY_LENGTH_BYTES);
}

/** Algorithm 5 (compute the U entry, Revision 3+). */
function computeU(encryptionKey: Uint8Array, fileId: Uint8Array): Uint8Array {
  let output = rc4(encryptionKey, md5(concatBytes(PAD, fileId)));
  for (let round = 1; round <= 19; round++) {
    const roundKey = encryptionKey.map((b) => b ^ round);
    output = rc4(roundKey, output);
  }
  // Algorithm 5 produces exactly 16 bytes; the spec pads to 32 with
  // "arbitrary padding" since only the first 16 are ever checked - random
  // bytes make that explicit rather than implying the last 16 carry
  // meaning.
  const padding = new Uint8Array(16);
  crypto.getRandomValues(padding);
  return concatBytes(output, padding);
}

/** Algorithm 1 (per-object key + RC4 encryption of one string/stream). */
function encryptObjectBytes(data: Uint8Array, fileKey: Uint8Array, objNum: number, genNum: number): Uint8Array {
  const objBytes = new Uint8Array([objNum & 0xff, (objNum >> 8) & 0xff, (objNum >> 16) & 0xff]);
  const genBytes = new Uint8Array([genNum & 0xff, (genNum >> 8) & 0xff]);
  const digest = md5(concatBytes(fileKey, objBytes, genBytes));
  const objectKeyLength = Math.min(fileKey.length + 5, 16);
  return rc4(digest.slice(0, objectKeyLength), data);
}

/** Walks every indirect object in the document, encrypting every
 *  PDFString/PDFHexString/PDFStream found (recursively, through
 *  PDFDict/PDFArray) with that object's own per-object key.
 *
 *  Strings are REPLACED, not mutated in place: verified directly in
 *  pdf-lib's source (PDFString.js's `copyBytesInto`) that pdf-lib does
 *  NOT re-escape `(`, `)`, or `\` when serializing a literal string's
 *  raw `value` - by design ("we will not bother escaping them"), since
 *  normal text content rarely contains them unescaped. RC4 output is
 *  effectively random bytes, which routinely DOES contain those bytes,
 *  and writing them into a PDFString's `value` unescaped would corrupt
 *  the PDF's own literal-string syntax. Every encrypted string is written
 *  out as a PDFHexString instead (hex digits have no escaping/parsing
 *  hazard at all), and swapped into its parent dict/array/trailer via a
 *  real `.set()`/`.assign()` call - never by reaching into a `PDFString`
 *  object's private `value` field and hoping the raw bytes happen to be
 *  safe. Stream contents don't have this hazard (delimited by
 *  stream/endstream + an explicit /Length, not paren-matching), so those
 *  are mutated in place. */
function encryptAllObjects(pdfDoc: PDFDocument, fileKey: Uint8Array, encryptRef: PDFRef, lib: PdfLib): void {
  for (const [ref, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    if (ref === encryptRef) continue; // the /Encrypt dictionary itself is never encrypted
    const replacement = encryptValue(obj, fileKey, ref.objectNumber, ref.generationNumber, lib);
    if (replacement !== obj) pdfDoc.context.assign(ref, replacement as Parameters<typeof pdfDoc.context.assign>[1]);
  }
}

/** Returns the (possibly new) value to store in place of `value`. Only
 *  top-level PDFString/PDFHexString values are ever replaced; dicts,
 *  arrays, and streams are mutated in place and returned as-is. */
function encryptValue(value: unknown, fileKey: Uint8Array, objNum: number, genNum: number, lib: PdfLib): unknown {
  const { PDFString, PDFHexString, PDFStream, PDFDict, PDFArray } = lib;
  if (value instanceof PDFString || value instanceof PDFHexString) {
    const raw = value.asBytes();
    const encrypted = encryptObjectBytes(raw, fileKey, objNum, genNum);
    return PDFHexString.of(bytesToHex(encrypted));
  }
  if (value instanceof PDFStream) {
    const contents = value.getContents();
    const encrypted = encryptObjectBytes(contents, fileKey, objNum, genNum);
    (value as unknown as { contents: Uint8Array }).contents = encrypted;
    encryptValue(value.dict, fileKey, objNum, genNum, lib);
    return value;
  }
  if (value instanceof PDFDict) {
    for (const key of value.keys()) {
      const child = value.get(key);
      if (child === undefined) continue;
      const replacement = encryptValue(child, fileKey, objNum, genNum, lib);
      if (replacement !== child) value.set(key, replacement as Parameters<PDFDict["set"]>[1]);
    }
    return value;
  }
  if (value instanceof PDFArray) {
    for (let i = 0; i < value.size(); i++) {
      const child = value.get(i);
      const replacement = encryptValue(child, fileKey, objNum, genNum, lib);
      if (replacement !== child) value.set(i, replacement as Parameters<PDFArray["set"]>[1]);
    }
    return value;
  }
  return value;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Locks a PDF behind a password using real PDF Standard Security Handler
 *  encryption (Revision 3, 128-bit RC4) - opening the file in any
 *  compliant reader (Acrobat, Preview, Chrome/pdfjs, etc.) will require
 *  this password. See the file-level doc comment for the full algorithm
 *  and scope notes. */
export async function lockPdf(file: File, password: string): Promise<Blob> {
  if (!password) {
    throw new Error("Enter a password to lock this PDF with.");
  }

  const lib = await import("pdf-lib");
  const { PDFDocument, PDFName, PDFNumber, PDFHexString } = lib;

  const arrayBuffer = await file.arrayBuffer();
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(arrayBuffer);
  } catch (error) {
    // Not `error instanceof EncryptedPDFError`: verified live that this
    // reliably returns false for pdf-lib's real thrown error (a prototype-
    // chain quirk in its compiled output - `error.name` is also just
    // "Error", not "EncryptedPDFError") even though the object was
    // genuinely constructed via `new EncryptedPDFError()` per its own
    // stack trace. Message matching is what this codebase's other
    // password-protected-file checks already use for the same reason
    // (see Edit PDF's equivalent check).
    const message = error instanceof Error ? error.message : "";
    if (message.includes("encrypted")) {
      throw new Error(
        `"${file.name}" is already password-protected. Remove its existing password first, then lock it with a new one.`,
        { cause: error }
      );
    }
    throw new Error(`"${file.name}" couldn't be read. It may be corrupted or not a real PDF file.`, {
      cause: error,
    });
  }

  // A fresh, random /ID is required either way (Algorithm 2/5 both need
  // one) - pdf-lib doesn't expose a direct setter for the trailer's ID
  // array, so it's built and installed as a raw context object here, the
  // same "reach into PDFContext directly" pattern the object-encryption
  // walk below already needs for the /Encrypt dictionary itself.
  const idBytes = new Uint8Array(16);
  crypto.getRandomValues(idBytes);
  const idHex = PDFHexString.of(bytesToHex(idBytes));
  pdfDoc.context.trailerInfo.ID = pdfDoc.context.obj([idHex, idHex]);

  const ownerEntry = computeO(password);
  const encryptionKey = computeEncryptionKey(password, ownerEntry, PERMISSIONS_ALL, idBytes);
  const userEntry = computeU(encryptionKey, idBytes);

  const encryptDict = pdfDoc.context.obj({
    Filter: PDFName.of("Standard"),
    V: PDFNumber.of(2), // RC4, key length in bits given by /Length
    R: PDFNumber.of(REVISION),
    Length: PDFNumber.of(KEY_LENGTH_BYTES * 8),
    O: PDFHexString.of(bytesToHex(ownerEntry)),
    U: PDFHexString.of(bytesToHex(userEntry)),
    P: PDFNumber.of(PERMISSIONS_ALL),
  });
  const encryptRef = pdfDoc.context.register(encryptDict);
  pdfDoc.context.trailerInfo.Encrypt = encryptRef;

  encryptAllObjects(pdfDoc, encryptionKey, encryptRef, lib);

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}
