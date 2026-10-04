# Product completion — second release candidate

Status: local implementation candidate; final combined build, independent acceptance and root release approval pending. Root mission `01a10439-5341-738a-ab91-9b92fea40024` remains the release authority. No production merge or deployment is authorized by this file.

## Scope

- Launch only the existing English `json-formatter`, `json-minifier` and `json-validator` tools: exact-token transforms, grammar diagnostics, appropriate text workspace, copy/download, limits and recovery. All other gated tools remain gated and incomplete translated counterparts remain unpublished.
- Repair public Excel-to-XML values and formula-cache handling, and its already-advertised alternate PDF export. Local files remain in the browser; the existing optional URL fetch remains explicitly disclosed.
- Repair Rotate/Delete/Extract cancellation, selection and mobile action placement; the existing native-field/link preservation gaps remain unfinished. Zero-page thumbnail loading now ends in a recoverable error.
- Repair scanner camera capture, input errors, page order and separate-output filename collisions. Camera permission is enabled only for scanner documents. Phone-to-computer transfer remains unfinished pending the owner's decision; no transfer provider or fake QR behavior is introduced.
- Terminate active PDF-to-Word OCR work on cancellation; preserve the first release's mixed native/scanned-page handling. The isolated 60-second production text-extraction stall remains unexplained after three successful traced production attempts.

## Evidence and remaining limits

- Final integrated tests: 219/219 pass; typecheck and lint pass (two pre-existing PDF-to-JPG image warnings). The earlier dc7a6fb optimized build passed, but the final application candidate requires its own fresh build and independent acceptance.
- Worker records: `docs/qa/2026-10-04-page-operations.md`, `docs/qa/scan-pdf-2026-10-04/README.md`, `docs/product-completion/data-batch2.md`, `docs/product-completion/qa-thumbnail-empty-2026-10-04/README.md`, `docs/qa/2026-10-04-pdf-word-cancellation.md` and `docs/qa/2026-10-04-pdf-word-early-action.md`.
- F's independent combined plan/harness is in `qa-batch2-prepared-2026-10-04.md`; it checks actual PDFs/DOCX/ZIP/XML/JSON, exact copy/download contents, document semantics (reported separately from bounded repair acceptance), cancellation/retry, camera stream cleanup, route gates, keyboard and emulated responsive/dark UI. Native mobile/camera certification is not claimed.
- Public-tool certification stays separate from these bounded repairs. Native form catalogs, internal destinations, tagged structure, page-label renumbering and signature guarantees are not certified by the page-operation slice. The attempted catalog-preserving Delete/Extract changes were reverted after a tagged fixture retained removed page content. Final page-subsetting engines match dc7a6fb, which contains the existing copy behavior plus reviewed cancellation and selection validation; deeper preservation work remains isolated. Scan transfer is incomplete. No public completion count is increased merely because a repair ships.
- No dependency, paid service, processing provider, growth campaign or content expansion. Only product launch metadata and corrections to directly affected existing help are included. Original 26-tool localization and 18-page pSEO scope remain fixed.

## Release and recovery

Production and rollback point: `3e92891a1d15821cfab7a204f65c097ccd9fdb45`, Vercel Ready production `5SaPq8nGe9BVtXadnijpEbputbtL`, https://pdfpilot.net. Re-fetch main and verify the current production assignment immediately before any root-approved merge. Use the existing protected GitHub/Vercel pipeline; no force push or stale deployment.

After deployment, F must verify fresh production sessions with real downloads/copy, affected public flows, the three new JSON routes, prior five launches and the four approved reference tools. If this release introduces a demonstrated regression, fix or restore the prior production through the existing pipeline under root authority and verify recovery.

Current certified counts remain **5/99**, comprising **0/26** original-public tools fully certified and **5/73** originally gated tools complete and live. Production availability remains **31 public / 68 gated** until a reviewed release. A candidate gate is not a completed tool.
