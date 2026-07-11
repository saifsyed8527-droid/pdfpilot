/**
 * Security Engine — architecture only, not implemented. Every function
 * below throws `SecurityEngineUnavailableError` unconditionally.
 *
 * WHY this is architecture-only, not implementation:
 * Verified (Phase 2 audit) that no trustworthy client-side library exists
 * for PDF encryption/decryption/digital signatures:
 * - pdf-lib: confirmed zero encryption/signing API (only a read-only
 *   `isEncrypted` flag) via node_modules/pdf-lib/es/api/PDFDocument.d.ts.
 * - pdf-encrypt (npm): depends on `fs: "^0.0.1-security"`, npm's
 *   placeholder convention for retired/malicious package names. Rejected.
 * - node-qpdf2 / @signpdf/signpdf: wrap Node-only APIs (child_process CLI
 *   calls, Node crypto) — architecturally incompatible with a browser.
 * - pdf-lib-plus-encrypt: unofficial single-maintainer fork of pdf-lib,
 *   stale since Jan 2023, 19.2MB/1588 files unpacked. Too high-risk to
 *   build a security feature on.
 * - qpdf-wasm: genuinely real (verified: actual Emscripten build of real
 *   qpdf, uses browser `crypto.getRandomValues`), but v0.1.0, 7 GitHub
 *   stars, single maintainer, no documented API. Doesn't clear this
 *   project's own dependency-quality bar (the same bar that rejected
 *   pptx-parser in the Document Conversion Suite sprint).
 *
 * A broken or unaudited encryption implementation is worse than no
 * encryption at all — it gives users false confidence their PDF is
 * protected. Faking this capability was explicitly ruled out.
 *
 * THE PATH TO REAL IMPLEMENTATION (server-side, deferred, not designed
 * away): a Next.js Route Handler under src/app/api/security/ (e.g.
 * encrypt/route.ts) that shells out to real `qpdf` (industry-standard,
 * used by Adobe and others,
 * supports RC4/AES-128/AES-256 encryption, owner/user passwords, and
 * permission bits) installed as a server binary — not the immature WASM
 * port. Digital signatures need a real PKI library server-side (e.g.
 * `node-signpdf` + a certificate, which is itself a business decision
 * about where the signing certificate comes from — not just a library
 * choice). See docs/phase-2-server-architecture.md for the full write-up.
 *
 * Every tool/UI in this codebase should call these functions through this
 * module, never a raw library — so when the server exists, only the
 * function bodies change; every call site, the registry, SEO, and nav
 * wiring are already correct.
 */

export class SecurityEngineUnavailableError extends Error {
  constructor(operation: string) {
    super(
      `${operation} requires server-side infrastructure that does not exist yet in this deployment. ` +
        `No trustworthy client-side library for this capability was found — see the doc comment on ` +
        `src/lib/engines/security-engine.ts for the full verification record.`
    );
    this.name = "SecurityEngineUnavailableError";
  }
}

export interface EncryptPdfOptions {
  userPassword?: string;
  ownerPassword?: string;
  /** Real qpdf-supported permission bits — modeled now so the eventual
   *  server implementation has a stable contract to fill in. */
  permissions?: {
    allowPrinting: boolean;
    allowCopying: boolean;
    allowModification: boolean;
  };
}

export async function encryptPdf(_file: File, _options: EncryptPdfOptions): Promise<Blob> {
  throw new SecurityEngineUnavailableError("PDF encryption");
}

export async function decryptPdf(_file: File, _password: string): Promise<Blob> {
  throw new SecurityEngineUnavailableError("PDF decryption");
}

export interface SignPdfOptions {
  certificateId: string;
  reason?: string;
}

export async function signPdf(_file: File, _options: SignPdfOptions): Promise<Blob> {
  throw new SecurityEngineUnavailableError("Digital signing");
}
