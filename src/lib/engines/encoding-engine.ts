/**
 * Encoding Engine — Base64 and URL encoding, using only browser-native
 * APIs (FileReader/atob/btoa, encodeURIComponent/decodeURIComponent).
 * Zero new dependencies: these are well-defined, standard encodings the
 * platform already implements correctly, not something worth pulling a
 * library in for.
 */

/** Encodes a file's raw bytes as a Base64 string via FileReader's
 *  `readAsDataURL` (real browser API), stripping the `data:...;base64,`
 *  prefix to return the bare Base64 payload — works for any file type,
 *  not just text, since it operates on bytes, not a decoded string. */
export function base64EncodeFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read the file."));
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
  return encodeURIComponent(text);
}

/** Decodes a URL-encoded string via `decodeURIComponent`, throwing a
 *  clear error for malformed percent-escapes (e.g. a truncated "%2" at
 *  the end of the string) rather than letting the raw URIError surface. */
export function urlDecode(text: string): string {
  try {
    return decodeURIComponent(text);
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
