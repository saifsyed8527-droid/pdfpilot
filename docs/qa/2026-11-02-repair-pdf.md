# Repair PDF — structure preservation and explicit visible recovery

## Shipped behavior

The tool now uses the shared PDF Pilot landing, workspace bar, preview/options and auto/repeat-download flow. The original file is kept in memory for retry. Replacement, removal, invalid-file feedback and cancellation remain available. Errors stay above the action; result/file changes return to the top of the page. Phone controls stack below the document preview.

Repair structure re-saves the original object graph instead of copying pages into a new PDF. This rebuilds cross references and preserves readable forms, original appearance streams, links, metadata, outlines and attachments. A missing trailer's orphaned Info dictionary is restored only when one unambiguous candidate exists. An independent PDF.js renderer checks every output page. Non-image page content/resource streams are also decoded separately because PDF.js can silently replace some corrupt streams with empty content even with stopAtErrors.

Recover visible pages is an explicit second mode: it renders the cropped, natively rotated appearance at 150 or 300 DPI and creates image-only PDF pages. It does not retain text selection, editable forms, links, bookmarks or attachments. An unreadable page stops recovery by default. Only the explicit Skip unreadable pages choice permits a partial output; the filename, result banner, open page report and TXT report identify every omitted source page and map surviving pages to output positions. Blank/faint rendered pages remain included with a review warning. No recoverable pages means no output.

Bounds: 100MB input, 200 pages, 200MB output, 16MP/8192px per rasterized page, 64MB decoded non-image resources per page, bounded resource traversal, and a 90-second renderer inactivity timeout. Cancellation aborts the active renderer/loading task and prevents stale output. Password encryption, XFA, signature fields and certification are rejected. No dependency or protected Merge/Split file changed.

## Verification

- Full suite: 375 tests passed, including six new output-based repair cases. Final UI/error wording changes passed the 48 relevant repair/capability tests; final production build includes lint and TypeScript checks and passed. Three pre-existing lint warnings remain.
- Missing cross-reference/trailer fixture: four native rotations with crop offsets, four form fields, URI link, Info metadata, bookmark and embedded note. Repaired output reopened independently with pypdf/PDFium; all four pages including form appearances rendered pixel-identically to the original at 2x. Fields, title, creation date, bookmark and attachment survived.
- Visible recovery: four image-only pages with the intended cropped visual dimensions; form appearances flattened correctly. Original selectable text and interactive fields are absent, as disclosed.
- Broken content stream on source page 2: normal repair and default visible recovery reject it. Explicit partial recovery produces source pages 1, 3, 4 in order, with page 2 marked not recovered. Blank pages, malformed headers, unreadable object data, geometry/size/page bounds, XFA/signature/encryption guards, abort-before-start and abort-between-pages are covered.
- Actual desktop browser downloads: missing-xref_repaired.pdf retained the four pixel-identical pages, fields, bookmark, title and attachment. broken-page_recovered_partial.pdf has three image pages; the actual TXT report maps source 1→output 1, source 2→NOT RECOVERED, source 3→output 2, source 4→output 3. Independently rendered all three pages and visually checked their text/form appearances and rotations.
- A 200-page job was cancelled while the UI showed Recovering page 2 of 200. The selected file/options remained; replacing it with a four-page file recovered successfully without reload or a stale download.
- At a measured 354×767 CSS viewport (phone-sized browser override), page width stayed 354px. A 24-byte invalid PDF produced an actionable error and no result; replacing it with the valid fixture recovered at 300 DPI. The actual four-page download contains 1500×1834 or 1834×1500 image pixels matching each page orientation. Result scroll position returned to zero. Temporary viewport settings were reset.

Private evidence remains outside the repository: fixtures/repair source/output files and JSON checks, release25-repair-partial.png, release25-repair-mobile-options.png and release25-repair-mobile-result.png. REPAIR_QA_DIR emits the synthetic engine fixtures.

## Limits

Recovery is best-effort, not a guarantee that damaged content is complete. Image codec failures and unusual resources may still produce incomplete visible content despite successful rendering; users must review the output. The tool cannot recreate missing bytes, preserve original digital signatures, recover deleted files or certify every PDF reader. Visible recovery changes the document to flattened page images and can enlarge the file. Supported limits are enforced bounds, not maximum-size performance certification. Broader reference parity and all-tool verification remain in progress.

## Production verification

PR #28 merged as `bf92e12754a91236dd4a9d1a6d5ae3d840d9dd3a`; production deployment `HLVQqQM11Hcs7husmiYLfGoXZfDR` passed. On pdfpilot.net, uploaded the synthetic damaged-page fixture, selected visible recovery and explicitly enabled skipping unreadable pages. The actual production download contains three image pages in source order 1, 3, 4, pixel-identical to the locally verified browser output. The live result identifies missing source page 2. Evidence: `fixtures/repair/production.pdf`, `production-verification.json`, and saved/viewed `release25-repair-live.png`.
