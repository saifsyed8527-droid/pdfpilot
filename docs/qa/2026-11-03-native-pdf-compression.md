# Native PDF compression — 3 November 2026

## Delivered behavior

Compress PDF now defaults to native qpdf optimization instead of flattening every page into a low-resolution JPEG. Searchable text, vectors, links, form fields, metadata, bookmarks and attachments remain in the native PDF. The existing upload → file cards/sidebar → processing → automatic/repeat download flow and all nine Merge/Split reference files are preserved.

- Three image quality levels use qpdf's JPEG optimization (50/75/92), compressed object streams and recompression of Flate streams. Existing JPEGs can be recompressed. Native mode does not downsample images. A lossless option skips JPEG changes and preserves original image quality.
- The existing image-only compression capability remains explicit, using 96/150/200 DPI and JPEG quality 0.5/0.7/0.92. The UI explains loss of searchable text, links, editable fields, bookmarks and attachments. Visible page dimensions, crop, native rotation and UserUnit are honored.
- Per-file clockwise rotation, A–Z/Z–A ordering, remove/add files, bounded previews, actual before/after size, individual and ZIP downloads, clear/reset/back to files, cancellation and retry. Without rotation the original bytes are returned when compression would not make the file smaller. A requested rotation is retained even when output size increases; the result says so.
- Up to 20 PDFs, 100MiB each, 200MiB combined input and completed output. Native mode supports 1,000 pages; image-only supports 200 pages and 16 megapixels/8,192 pixels per rendered side. Worker and raster timeouts are 180 seconds. Previews are sequential, at most 230 × 280 pixels, and paused during export or the result screen. Password batches also enforce the combined completed-output ceiling.
- One file's failure does not discard another file's successful output. Partial downloads explicitly say how many files were omitted. Successful files are retained through cancellation, removal of a bad file and addition of a replacement. Distinct ZIP names preserve duplicate input names.
- Encrypted files direct users to Unlock PDF. Signed/certified documents, invisible signature fields, XFA, malformed streams and excessive complexity are rejected. The qpdf core/worker and cancellation wrapper are shared with Protect/Unlock PDF; the cryptographic core and licenses are unchanged.

## Reference review

Reviewed all 18 screenshots in supplied extraction group 16 and all 7 in group 20: three quality levels, thumbnails, rotation, removal/addition, process/result, size savings, download/restart and related actions. Extraction groups are not asserted to equal the original Google Docs tab numbers. No private reference document was uploaded. Google Drive/Dropbox OAuth and server-hosted share/delete links are not simulated.

qpdf's own documentation describes the native compression/quality options and their limits: <https://qpdf.readthedocs.io/en/stable/cli.html#optimizing-file-size>. The original pinned runtime provenance and licenses remain in `public/qpdf/`. No new package or hosted processing service was introduced.

## Verification

- Eight optimization tests cover pixel-exact lossless output, all native rotations/crops/UserUnit, native form values/text/links/metadata/attachment/outline preservation, three real JPEG quality levels, existing JPEG recompression, transparent-image masks, requested rotation, byte-identical unchanged files, invalid/encrypted/signed/XFA/page-limit rejection, explicit flattening, active worker/raster cancellation/retry and bounded previews. The eight password tests also passed after sharing the worker adapter.
- Actual browser source: 853,440 bytes, four rotated/cropped pages, UserUnit, photograph, searchable text, four fields, links, Unicode metadata, outline and attachment. Lossless output was 847,871 bytes; independent PDFium rendering was pixel-identical on every page. Native recommended output was 438,970 bytes (about 49% smaller), with text, all four fields, metadata and attachment independently read from the downloaded PDF.
- Mixed batch: rotated photo/text PDF, already-small PDF and a malformed compressed stream. The malformed file failed; the two successes were retained and downloaded with an explicit omitted-file notice. The small file was byte-identical; the rotated PDF had page rotations 90/180/270/0 and retained all fields. After removing the bad file and adding a duplicate-named replacement, only the new file processed; the real ZIP contained three distinct valid entries.
- Mobile checked at 354 × 767 CSS pixels, with no horizontal document overflow. Explicit image-only/Extreme plus +90° rotation produced a real 191,804-byte PDF (about 78% smaller), with four nonblank pages and the correct visible dimensions, including UserUnit. Text, links and fields were absent as disclosed. Temporary viewport settings were reset. Options and result screenshots were visually inspected.
- Actual 20-file cancellation: stopped while the third file was processing, retaining three completed files. Retry handled the remaining 17; the downloaded ZIP contained 20 readable native PDFs with all 80 pages searchable and all 80 form fields retained. Previews pause during export to avoid simultaneous preview/export work.
- Final checks: all 423 tests passed, type checking and the production build passed, and all nine Merge/Split reference hashes remained unchanged. A real download from the production build was independently decoded: 438,969 bytes, four searchable pages, four form fields and the original attachment retained. Browser-session interruptions during the final check were recovered; only the completed download is counted as verification.

Synthetic inputs, actual downloads and screenshots are in local `audit-2026-10-29/fixtures/pdf-optimize/` and `release31-*` evidence, outside the published repository.

## Boundaries

No exact KB target or percentage reduction is promised. JPEG optimization is lossy and some image formats/resources cannot benefit; repeated shared image resources can limit savings. Lossless optimization can leave an already efficient file unchanged. Image-only output is a new image-based PDF, not a structural repair or preservation mode. Certificate signatures and PDF/A conformance are not preserved/certified by this compressor. Legacy Split-size compression and combined workflow helpers remain separate; their behavior was not expanded in this change. These tests do not establish every-PDF, every-reader or full competitor parity.

Production verification: PR #34 merged as `68a13d1623050892f4cdf0e4164d9420022c2d2b`; Vercel deployment `DVj6peEVLYFceNU3KFgHgvikD7cU` succeeded. A real download from pdfpilot.net/compress-pdf was independently decoded with all four searchable pages, all four fields and the attachment retained (438969 bytes; SHA-256 `03d05238a4e8cf3def180c35166b16f017adf173f80c0b38d563da0e03da8019`). The live result screenshot was visually inspected.
