# Protect and Unlock PDF — 3 November 2026

## Delivered behavior

Protect PDF now creates AES-256 revision 6 encrypted PDFs using the original qpdf CLI compiled to WebAssembly. It replaces the custom RC4 implementation. Unlock PDF removes encryption from native PDF objects instead of converting pages into images. Both tools keep PDFPilot's upload → preview/options → processing → automatic/repeat download flow; all nine Merge/Split reference files remain unchanged.

- Up to 20 PDFs, 50MiB each and 200MiB combined; 1,000 pages per file. The same open password protects a batch; existing PDFs can use a shared current password or per-file overrides. Known open or owner passwords are accepted. Files that already open without a password can be processed with an empty password.
- Protection requires matching confirmation. An optional separate owner password and print, edit and copy permissions are available. If omitted, a separate owner password is generated locally with browser cryptographic randomness. Reader-dependent restrictions are explained in the UI.
- Explicit password preview, page navigation, per-file errors, cancellation, retry of unfinished files, removal, individual downloads and ZIP download. Successful files survive another file's failure or cancellation. Partial downloads explicitly identify omitted files. A plain PDF that passes inspection and syntax/stream checking is returned byte-for-byte unchanged.
- PDF files and passwords stay in a fresh local worker, including qpdf's in-memory filesystem. Workers terminate on completion, cancellation, unmount or a 180-second timeout. Raw CLI diagnostics and recovered legacy passwords are never posted to the UI or logged. New passwords accept up to 127 UTF-8 bytes; controls and invalid Unicode are rejected.
- Signed/certified PDFs, signature fields without page widgets, XFA forms, invalid documents and excessive complexity are rejected. Output page/field counts, encryption parameters and qpdf syntax/stream validation are checked before returning a file.

## References and runtime provenance

Reviewed every image in supplied extraction groups 43 (4) and 44 (9). Extraction numbers are not asserted to be original Google Docs tab numbers. Private screenshot credentials were not reused or published; all verification files/passwords are synthetic.

The unchanged qpdf core is vendored from the **unofficial** npm package `@wasm-zoo/qpdf@0.1.1`, building upstream qpdf 12.4.2. SHA-512 package integrity, SHA-256 core hashes, build/source metadata, SBOM, Apache-2.0 and dependency licenses are retained in `public/qpdf/`. No installer scripts ran; shared dependencies were not changed. See that directory's README for primary source links. Only `/qpdf/worker.js` receives the required WASM CSP permission; the general page policy is unchanged.

## Verification

- Final full suite: **415 passing**, zero failed/skipped. The 50 password/pSEO checks also passed after updating the three reviewed configuration hashes. Type checking and the production build passed; the built worker's CSP was checked over HTTP and successfully ran in the actual browser.
- Eight password-engine tests cover independent PDF.js reading/rendering of real AES-256 protection, missing/wrong/correct passwords, separate owner permissions, re-protection, Hindi/Arabic/Chinese/emoji and option-like password text, legacy RC4/AES-128, empty-user-password restrictions, byte-identical plain documents, damaged streams, invalid PDFs, signature/certification/XFA guards, page limits, cancellation/retry and duplicate ZIP names. Tests use the same adapter and public worker code as the browser.
- Actual browser protection: 4 rotated/cropped pages including UserUnit, selectable text, 3 editable form fields, a link, outline, metadata and attachment. An independent pypdf reader confirmed AES-256 `/R 6`, `/V 5`, 256 bits and the selected restrictions. Missing/wrong passwords failed; the correct synthetic password opened the result.
- Mixed batch: encrypted PDF with missing/wrong password, owner-restricted file with no open password, ordinary PDF and malformed PDF. Two successful files remained downloadable while two failed. Correcting the per-file password and removing the bad file produced a 3-file ZIP. Every downloaded PDF decoded; independent PDFium rendering matched the original pixels on all 4 pages, with form values, metadata and attachment intact. The original unencrypted file was byte-identical.
- Cancelled an active 20-file unlock batch after 17 successes. The 17 results were kept; retry processed only the remaining 3. The actual downloaded ZIP contained 20 valid unencrypted 4-page PDFs with 3 fields each.
- Built mobile flow checked at 354 × 767 CSS pixels, with document width exactly 354px. A Hindi/Arabic synthetic password produced an actual AES-256 PDF, independently opened with the correct password while a wrong password failed; all 4 pages and 3 fields remained. Mobile options/result screenshots were visually inspected and the temporary viewport override was reset.

Local synthetic inputs, browser downloads and check output are in `audit-2026-10-29/fixtures/pdf-password/`, outside the published repository. The desktop protection result screenshot was visually inspected.

Production: PR #33 merged at `7688e47c777dedb0df95405c62eca1cab53eb875`; Vercel deployment `9L63JvQxfqNrtUQUztb7fdpd1uPG` succeeded. A live browser downloaded the native unlocked fixture (7,222 bytes, SHA-256 `0d5c5c508c429f60f42862fe8e7eab26432bdfacfe2f99b4861002e012002a09`). Independent PDFium/pypdf checks confirmed all four pages pixel-identical to the source, with three fields, metadata and the attachment retained. `release30-password-live.png` was visually inspected.

## Boundaries

This does not recover an unknown open password, supply certificate signing, guarantee that every reader respects permission flags, or make a DRM claim. AES-256 requires a compatible PDF reader. qpdf's Unicode password behavior is retained; uncommon Unicode normalization differences between readers are not certified. The WASM core has a 512MiB memory ceiling; input/output, report, object and form-tree limits plus worker termination bound processing. These checks do not establish complete compatibility with every PDF, browser or reader.
