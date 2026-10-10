# Product completion — second release candidate

Status: recovered final candidate. Application source remains frozen at `2ba44383d60fd592843417bf47d6b8cfdfbf8a4c`; [PR2](https://github.com/saifsyed8527-droid/pdfpilot/pull/2) contains the bounded product release. Fresh 10 October release checks pass: 219 tests, typecheck, lint and optimized build. Final historical browser/output acceptance is recovered under `qa-batch2-built/`; current independent release review is under `qa-release-2026-10-10/`. The current project execution owner is the release authority under the owner’s explicit 10 October mandate.

## Scope

- Launch only the existing English `json-formatter`, `json-minifier` and `json-validator` tools: exact-token transforms, grammar diagnostics, appropriate text workspace, copy/download, limits and recovery. All other gated tools remain gated and incomplete translated counterparts remain unpublished.
- Repair public Excel-to-XML values and formula-cache handling, and its already-advertised alternate PDF export. Local files remain in the browser; the existing optional URL fetch remains explicitly disclosed.
- Repair Rotate/Delete/Extract cancellation, selection and mobile action placement; the existing native-field/link preservation gaps remain unfinished. Zero-page thumbnail loading now ends in a recoverable error.
- Repair scanner camera capture, input errors, page order and separate-output filename collisions. Camera permission is enabled only for scanner documents. Phone-to-computer transfer remains unfinished pending the owner's decision; no transfer provider or fake QR behavior is introduced.
- Terminate active PDF-to-Word OCR work on cancellation; preserve the first release's mixed native/scanned-page handling. The isolated 60-second production text-extraction stall remains unexplained after three successful traced production attempts.

## Evidence and remaining limits

- Final integrated tests re-run on 10 October: 219/219 pass, typecheck/lint/optimized build pass. Two pre-existing PDF-to-JPG image warnings remain. Application/config/dependency/test files equal frozen `2ba4438`; subsequent integration changes are QA/docs only.
- Worker records: `docs/qa/2026-10-04-page-operations.md`, `docs/qa/scan-pdf-2026-10-04/README.md`, `docs/product-completion/data-batch2.md`, `docs/product-completion/qa-thumbnail-empty-2026-10-04/README.md`, `docs/qa/2026-10-04-pdf-word-cancellation.md` and `docs/qa/2026-10-04-pdf-word-early-action.md`.
- F's independent combined plan/harness is in `qa-batch2-prepared-2026-10-04.md`; it checks actual PDFs/DOCX/ZIP/XML/JSON, exact copy/download contents, document semantics (reported separately from bounded repair acceptance), cancellation/retry, camera stream cleanup, route gates, keyboard and emulated responsive/dark UI. Native mobile/camera certification is not claimed.
- F has passed exact JSON clipboard/downloads (including output beyond the preview limit), six keyboard cases across all three JSON tools, Excel PDF/XML dispatch and actual outputs, Word startup/active-OCR cancellation and editable retry output, scanner camera cleanup/order/rotation/ZIP/recovery and emulated responsive/dark UI. B bounded page-operation acceptance, all four reference regressions and prior-five launch regressions also passed; final reports and actual outputs were recovered from F on 10 October. Root's independent static source review found no confirmed blocker. Synchronous parse remains cooperatively cancellable; startup OCR disposal waits for the library to expose its worker.
- Public-tool certification stays separate from these bounded repairs. Native form catalogs, internal destinations, tagged structure, page-label renumbering and signature guarantees are not certified by the page-operation slice. The attempted catalog-preserving Delete/Extract changes were reverted after a tagged fixture retained removed page content. Final page-subsetting engines match dc7a6fb, which contains the existing copy behavior plus reviewed cancellation and selection validation; deeper preservation work remains isolated. Scan transfer is incomplete. No public completion count is increased merely because a repair ships.
- No dependency, paid service, processing provider, growth campaign or content expansion. Only product launch metadata and corrections to directly affected existing help are included. Original 26-tool localization and 18-page pSEO scope remain fixed.

## Release and recovery

Production and rollback point: `3e92891a1d15821cfab7a204f65c097ccd9fdb45`, Vercel Ready production `5SaPq8nGe9BVtXadnijpEbputbtL`, https://pdfpilot.net. Re-fetch main and verify the current production assignment immediately before the current project owner’s reviewed merge. Use the existing protected GitHub/Vercel pipeline; no force push or stale deployment.

After deployment, the current execution owner must verify fresh production sessions with real downloads/copy, affected public flows, the three new JSON routes, prior five launches and the four approved reference tools. If this release introduces a demonstrated regression, fix or restore the prior production through the existing pipeline under root authority and verify recovery.

Current certified counts remain **5/99**, comprising **0/26** original-public tools fully certified and **5/73** originally gated tools complete and live. Production availability remains **31 public / 68 gated** until a reviewed release. A candidate gate is not a completed tool.
