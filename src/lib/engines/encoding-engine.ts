/**
 * Encoding Engine — Base64 and URL encoding, using only browser-native
 * APIs (FileReader/atob/btoa, encodeURIComponent/decodeURIComponent).
 * Zero new dependencies: these are well-defined, standard encodings the
 * platform already implements correctly, not something worth pulling a
 * library in for.
 */

export const ENCODING_FILE_LIMIT = 100 * 1024 * 1024;
export const ENCODING_TEXT_LIMIT = 1024 * 1024;

export function assertEncodingFileSize(size: number): void {
  if (size > ENCODING_FILE_LIMIT) throw new Error("Choose a file of 100 MB or smaller.");
}

/** TextEncoder replaces lone UTF-16 surrogates. Reject them instead of silently
 * changing pasted input, and preserve BOMs and all whitespace in valid text. */
export function utf8Bytes(text: string): Uint8Array<ArrayBuffer> {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("The text contains an incomplete Unicode character. Replace it and try again.");
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error("The text contains an incomplete Unicode character. Replace it and try again.");
    }
  }
  return new TextEncoder().encode(text);
}

export function base64EncodeText(text: string): string {
  const bytes = utf8Bytes(text);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return btoa(chunks.join(""));
}

export async function readEncodingTextFile(file: File): Promise<string> {
  assertEncodingFileSize(file.size);
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error("This file is not valid UTF-8 text. Save it as UTF-8 and try again.");
  }
}

/** Binary output must remain downloadable even if it is not readable text. */
export async function decodedTextPreview(blob: Blob): Promise<string | null> {
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await blob.arrayBuffer());
    return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text) ? null : text;
  } catch {
    return null;
  }
}

/** Encodes a file's raw bytes as a Base64 string via FileReader's
 *  `readAsDataURL` (real browser API), stripping the `data:...;base64,`
 *  prefix to return the bare Base64 payload — works for any file type,
 *  not just text, since it operates on bytes, not a decoded string. */
export function base64EncodeFile(file: File): Promise<string> {
  assertEncodingFileSize(file.size);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.onabort = () => reject(new Error("Reading the file was cancelled."));
    reader.readAsDataURL(file);
  });
}

/** Decodes a Base64 string back into a Blob of raw bytes via `atob`.
 *  Throws a clear error for input that isn't valid Base64 rather than
 *  producing garbage output — `atob` itself throws a DOMException on
 *  invalid input, caught and re-thrown with a message a non-technical
 *  user can act on. */
export function base64DecodeToBlob(base64Text: string, mimeType: string = "application/octet-stream"): Blob {
  const cleaned = base64Text.trim().replace(/\s+/g, "");
  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    throw new Error("This doesn't look like valid Base64 text — it couldn't be decoded.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/** Encodes text for safe use inside a URL component (query string value,
 *  path segment) via the standard `encodeURIComponent`. */
export function urlEncode(text: string): string {
  utf8Bytes(text);
  return encodeURIComponent(text);
}

/** Decodes a URL-encoded string via `decodeURIComponent`, throwing a
 *  clear error for malformed percent-escapes (e.g. a truncated "%2" at
 *  the end of the string) rather than letting the raw URIError surface. */
export function urlDecode(text: string, plusAsSpace = false): string {
  try {
    utf8Bytes(text);
    return decodeURIComponent(plusAsSpace ? text.replace(/\+/g, " ") : text);
  } catch {
    throw new Error("This doesn't look like valid URL-encoded text — it contains a malformed escape sequence.");
  }
}

/** Decodes one Base64URL segment (the `-`/`_`, no-padding variant JWTs use,
 *  distinct from standard Base64) into its original UTF-8 text — converts
 *  to standard Base64 alphabet and re-adds padding before `atob`, then
 *  decodes the resulting binary string as UTF-8 via `TextDecoder` rather
 *  than treating `atob`'s output as text directly, since claims can
 *  contain non-ASCII characters `atob` alone would mangle. */
function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error("This part of the token isn't valid Base64URL.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export interface DecodedJwt {
  header: unknown;
  payload: unknown;
}

/** Decodes a JWT's header and payload — real Base64URL decoding of the
 *  first two dot-separated segments, each parsed as JSON. Deliberately
 *  does not touch the third segment (the signature): verifying a
 *  signature requires the issuer's real secret or public key, which this
 *  tool never has, so claiming to "verify" anything here would be
 *  fabricated. This is a decode-and-inspect tool, not a verifier. */
export function decodeJwt(token: string): DecodedJwt {
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    throw new Error(
      "This doesn't look like a JWT — a JWT has three dot-separated parts (header, payload, signature)."
    );
  }
  const [headerPart, payloadPart] = parts;

  let header: unknown;
  try {
    header = JSON.parse(base64UrlDecode(headerPart));
  } catch {
    throw new Error("The token's header isn't valid Base64URL-encoded JSON.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecode(payloadPart));
  } catch {
    throw new Error("The token's payload isn't valid Base64URL-encoded JSON.");
  }

  return { header, payload };
}
