# PDF to PowerPoint: appearance and viewer reliability

Updated 28 November 2026. Local branch `codex/pdf-pptx-fidelity-20261127`, based on `27c3f7a`. This report does not record a production release.

## Current behavior

Each appearance-mode slide uses its own standard OOXML slide layout containing exactly one full rendered PDF page image. The slide itself contains no drawing objects. This avoids a macOS Quick Look picture-reuse bug while retaining page coordinates, dimensions and ordering. Native and OCR text is retained in speaker notes, never drawn over the page. Individual text, pictures, charts and vectors are not reconstructed as editable slide objects. Notes and reports state this explicitly; workspace notices cover all 26 interface languages without claiming native-speaker certification.

Native selectable text stays authoritative under forced OCR. Recognized words overlapping native text are filtered, including rotation. OCR/model failure preserves the original page and any native text, reports the failure and avoids restarting a broken worker on each subsequent page. Cancellation still aborts conversion. Existing file/page/raster/text/output limits remain.

The normal workspace always preserves appearance. Legacy text-only engine output remains for compatibility, but is not offered by the converter. New source files reset page selection and slide size. Language search matches codes and English/native labels; OCR does not translate. Long filenames wrap on mobile. The existing upload/options/progress/download structure and browser-local processing remain; no new dependency, service or paid infrastructure is introduced.

## Failures and corrections

The original 12-page sofa output and the subsequently supplied 70-page catalogue/sofa files contain text without their source artwork. Later cozy/rocking chair outputs contain transparent text drawn over page images. Quick Look ignores that text transparency and displays doubled titles/body text. The first LibreOffice-only verification missed this incompatibility.

The 27 November local layer-order fix was also incomplete: the 70-page catalogue exposed repeated images in native Quick Look despite correct ZIP image parts and relationships. Putting text underneath a white backing was insufficient. The earlier reports and failed output are preserved in the private evidence folder rather than treated as current passes.

Controlled native-viewer tests varied drawing objects, image names, identifiers, XML comments, image metadata, slide backgrounds and ZIP compression. Keeping pictures directly on slides was still intermittently wrong, even after 15 or 25 consecutive passes. A separate empty layout per page also failed. These failures are retained as negative controls; none is treated as the final fix.

The final engine moves each page picture and its image relationship into a **dedicated picture-bearing slide layout**. It registers those layouts in the content-types table and master relationships, leaves source JPEG/PNG bytes untouched, and keeps notes on their corresponding slides. This standard Office structure also supports mixed-size and cropped pages without adding a second raster pass. The 70-page native diagnostic passed 100 consecutive checks (7,000 displayed page images). Engine-generated 48-page JPEG and PNG storyboards each passed 40 consecutive native checks; multilingual and source/wide/standard cropped-title decks also passed. A duplicate-image assertion remains in the repeatable checker so a valid ZIP alone cannot count as a viewer pass.

Unique per-page picture names/descriptions, drawing/image-relationship IDs, distinct media paths and DEFLATE compression are retained. PptxGenJS 4.0.1 ignores `compression` when `write` receives `outputType`; repacking uses the existing `fflate` dependency. No PNG metadata injection, hash renaming, XML padding, extra background image, or lossy second encoding is used.

## Verification and repeatable checks

- `tests/pdf-powerpoint.test.cjs` checks source-image pixels/order, CropBox/rotation/UserUnit, mixed sizes, native text precedence, Spanish/Hindi/Arabic OCR, failed OCR, cancellation/retry, limits and two 48-page JPEG/PNG storyboards. Every appearance archive must resolve to its own picture-bearing layout, contain exactly one visible picture with no overlaid text, register its layout and media relationships, use compressed Office entries, and retain extracted text in notes.
- Set `PDF_PPTX_SOURCE` to a private PDF and optionally `PDF_PPTX_DPI=150` or `300` to compare every encoded page image against a fresh corresponding source render. `PPTX_QA_DIR` writes local evidence; no private input is committed.
- Run `node scripts/check-pdf-powerpoint-quicklook.cjs file.pptx [...]` on macOS. It generates temporary native Quick Look previews and checks that every displayed image equals its corresponding PPTX image part, then removes the previews. It catches repeated/wrong images even when archive structure and slide counts pass.
- The JPEG/PNG 48-page storyboards (40 native passes each), four-page multilingual output and source/wide/standard cropped-title cases pass the native viewer check. `final-native-fixtures.json` records all 84 runs. Microsoft PowerPoint/Google Slides are not substituted for the user’s actual Quick Look acceptance target.
- Owner-file coverage consists of the supplied 70-page catalogue, 12-page sofa, eight-page cozy chair and eight-page rocking chair. The final production-browser downloads passed 20 native Quick Look checks per file (80 runs, 1,960 displayed pages). All 98 retained native previews reference their own exact source image bytes, show no additional text when non-image content is hidden, and match independent source renders. All 98 pages also passed a separate LibreOffice render comparison. The earlier picture-on-slide artifacts are historical failed evidence, not current passes. Completion is claimed only for checks recorded as passed in those reports.
- Final validation: 24/24 engine/locale tests including the 70-page private source; typecheck; lint (four existing unrelated warnings); secret-boundary checks; production build (3,030 routes, including 20 prebuild SEO/locale checks); four real browser downloads; six OCR/recovery/mobile scenarios; and a successful 12-page PowerPoint-to-PDF round trip. Source/capability bindings are revalidated after recording this report. Microsoft PowerPoint/Google Slides application certification and universal error-free conversion are not claimed.

## Capability compatibility

The existing Mac guide describes rendered page images and optional extracted text without promising individually editable original objects; those statements remain accurate. Its workspace reuses the fixed converter. Word/Excel engines and output semantics are unchanged by shared language-search/result wrapping fixes. Existing capability/review hashes are refreshed only for changed evidence; pSEO page copy, keyword data, indexability and historic approval state are unchanged.

Private evidence: parent project `outputs/pdf-pptx-fidelity-2026-11-28/`; historical evidence: `outputs/pdf-pptx-fidelity-2026-11-27/`. No customer documents or preview images are added to the source repository.

## Practical limits

Visible pages are high-quality raster images; JPEG/resampling can cause minor pixel differences. Speaker-note text remains in the original language and may need proofreading after OCR. Mixed-size pages fit the first selected source page or the selected 16:9/4:3 size without stretching. Large jobs remain bounded by the existing limits and device memory.
