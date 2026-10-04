# Encoding batch — Agent E

## Scope and ownership

Four existing gated tools: `base64-encode`, `base64-decode`, `url-encode`, `url-decode`. E owns their exact clients, `src/lib/engines/encoding-engine.ts`, and (approved by parent) `src/app/base64-encode/encoding-tool-client.tsx`. A owns `src/components/tool/TextToolWorkspace.tsx`; dependency commit 44d1b0b was cherry-picked locally as 633a7b2. P owns launch gates, metadata, registry, routes and production integration.

The full assignment remains all 51 E entries in `tool-status.json`. This batch does not claim the other 47 tools are complete. Original cohort for each of these four is gated; none is counted production-complete yet.

## User tasks and bounded requirements

| Tool | Input → output | Existing behavior retained | Gaps completed |
|---|---|---|---|
| Base64 Encode | Any file's bytes or Unicode text → standard Base64 text | Browser-local raw-file encoding, 100 MB file ceiling, downloadable text | UTF-8 paste/editor, input source choice, preview, complete-output copy, editable filename, reset, shared workspace |
| Base64 Decode | Standard Base64 text/file → original bytes | Raw binary download, whitespace/unpadded support, invalid input rejection | Text paste/editor, UTF-8 preview when lossless, binary-safe result, filename choice, text copy only when appropriate, inline error/retry |
| URL Encode | Unicode text/UTF-8 file → encoded URL component text | `encodeURIComponent` semantics, file workflow, local download | Paste/editor, readable result, copy, filename, reset, strict UTF-8 file validation |
| URL Decode | Percent-encoded text/UTF-8 file → decoded Unicode | `decodeURIComponent` semantics and malformed escape failure | Paste/editor, optional `+`→space for form/query values, preview/copy, retry/reset, strict file validation |

No new processing service, dependencies, transmission, AI, spending or production gates. No changes to reference tools or existing SEO/localizations. The base64 decoder does not claim to accept Base64URL or entire data URIs. URL tools explicitly operate on components, not whole-URL structure. Base64 decode never converts binary output into a lossy text download.

File inputs retain the existing 100 MB ceiling. New pasted/edited text is limited to 1,048,576 UTF-16 characters. Larger uploaded text remains supported with a read-only 100,000-character preview; the complete input is processed and complete output copied/downloaded. Output previews truncate at 100,000 characters with an explicit label. Result invalidation occurs on mode, input or decoding-option changes. All state is local and reset clears input, file, result, settings and filename.

## Design and references

Uses A's approved `TextToolWorkspace`/`TextToolPanel`, built on `PdfWorkspaceBar`: slate surfaces, rounded-3xl cards, existing amber dark-mode action, named editors, primary action near the top, wrapped mobile actions. Editors suit the job without PDF page cards. Primary design contract derives from Merge/Split/Compress/PowerPoint.

Encoding references inspected 4 October 2026: [RFC 4648](https://www.rfc-editor.org/info/rfc4648/), [browser Base64/Unicode semantics](https://developer.mozilla.org/en-US/docs/Web/API/Window/btoa), [encodeURIComponent behavior](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent). Observable standards behavior informs UTF-8 conversion, standard Base64 alphabet and URL component escaping. This is bounded encoding behavior, not competitor parity.

## Verification checkpoint

- `node --test tests/encoding-engine.test.cjs`: 9/9 pass. Exact Unicode/BOM/whitespace bytes, all256 byte values, invalid UTF-8/percent/Base64/lone-surrogate inputs, plus behavior, long input, JWT consumer compatibility.
- `npm run typecheck`: passed after implementation and A shell adoption.
- `npm run lint`: passed with only two pre-existing pdf-to-jpg image warnings. Full `npm test`: 152/152 passed. Parent requested no duplicate build; combined production build remains integration acceptance.
- `scripts/check-encoding-browser.cjs`: automated downloaded/copied output checks, binary roundtrip, malformed recovery, option/edit invalidation, large complete-output check, width375/768/1440 light/dark screenshots. Local temporary route prefix `/__qa-codec`; harness is removed before commit and never published. All four Unicode download/copy/reset checks, binary256-byte roundtrip, malformed recovery, UTF-8 replacement, editable file text and plus setting passed. The final large-file check failed because its assertion ran before async file loading completed; the harness now waits for readOnly and F must verify that final case on the combined candidate. No product failure is established by that timing failure.
- Independent F source review: no blocking defect; independent browser verification pending on combined parent port4400.
- Production availability remains gated; no live verification or release claim.

## Resume

Worktree `/Users/apple/Documents/Codex/2026-10-04/task/workers/e`, branch `codex/product-e-2026-10-04`. E local server stopped and temporary harness removed after parent request to consolidate on port4400. Screenshots and synthetic downloaded files are preserved at reports/encoding-browser (not committed). Inspected mobile dark and desktop light screenshots show proper editor/card layout and reachable output controls; buttons appear visually muted despite passing interactions, referred to A for independent baseline/style review. Finish F large-file/output and A visual checks on the combined candidate. Parent integrates A once, reviews actual launch metadata/capability/gate requirements, runs combined build and releases only after root approval.
