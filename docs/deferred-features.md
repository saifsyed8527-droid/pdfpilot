# Deferred features — consolidated list

Every capability named in the Phase 2B/2C briefs that is not implemented,
in one place, with why and what would change that. "Deferred" means
architecturally planned or explicitly ruled out for a stated reason — not
forgotten and not silently dropped. Nothing here was faked in the
meantime; each deferred tool/format simply doesn't exist as a page.

## Server-dependent (architecture complete, implementation deferred)

| Capability | Why deferred | Where the plan lives |
|---|---|---|
| PDF encryption / password protection | No trustworthy client-side library (verified: pdf-lib has no encryption API; `pdf-encrypt` depends on a known-malicious placeholder package; `qpdf-wasm` is v0.1.0/7 stars/no docs) | [phase-2-server-architecture.md](phase-2-server-architecture.md), `security-engine.ts` |
| PDF unlock/decrypt | Same as above | Same |
| Digital signatures | Needs a real PKI library + a certificate-sourcing business decision, both server-side | Same |
| Server-side OCR (higher accuracy than tesseract.js) | Not needed yet — tesseract.js via WASM covers the browser-native OCR family completely; a server OCR path would only be justified by a real accuracy/language gap that hasn't been identified | Same doc, AI/Security section pattern applies |
| AI features (summarize, translate, chat with document) | LLM API keys cannot be safely embedded in client-side code — a hard constraint of bearer-token auth, not a missing library | Same doc, `ai-engine.ts` |
| Background removal | `@imgly/background-removal` is a real candidate, not newly vetted this sprint — carried over from an earlier phase's notes, not rejected | Not yet written up; next candidate for a dependency-review pass |

## Browser-native but genuinely unimplemented

| Capability | Why deferred |
|---|---|
| PDF → Excel | See [pdf-to-excel-strategy.md](pdf-to-excel-strategy.md) — the one gap with its own dedicated doc, since it's the most-requested remaining conversion direction. |
| HEIC/HEIF input or output | Chrome and Firefox cannot decode HEIC via `createImageBitmap` at all; the one real npm candidate (`heic2any`) has been stale since 2023. Documented in `image-engine.ts`'s own doc comment as a verified, not assumed, gap. |
| DOCX split / DOCX page extraction / DOCX metadata reading | No second real consumer existed to justify extracting shared engine surface for these — `word-engine.ts` only has `extractDocxBlocks`/`buildDocxFromBlocks` today. |
| OCR language selection UI | `recognizeText` in `ocr-engine.ts` and tesseract.js both support it technically; the OCR Image/OCR PDF tool UIs don't expose a language picker yet. A real gap, not a fake feature — the tools default to English-only recognition. |
| Searchable PDF export from OCR | tesseract.js can produce the data a searchable-PDF (image + invisible text layer) needs; `exportOcrResult` only implements TXT and DOCX export today. |
| HTML, JSON, XML, RTF, ODT as text-document input formats | TXT/Markdown/CSV cover the real demand identified so far; each remaining format needs its own honestly-scoped parser, not a shared shim pretending to support all of them equally. |

## Explicitly ruled out, not "not yet"

Nothing in this project has been permanently ruled out as of Phase 2C —
every item above has a real, stated path to implementation. The
distinction that matters is *server-dependent* (architecture done,
waiting on infrastructure that's a deliberate future decision) vs.
*browser-native but not built yet* (could be started any time, just
hasn't been prioritized over what shipped this sprint).
