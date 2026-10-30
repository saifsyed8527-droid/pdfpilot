# Multilingual OCR PDF — 30 October 2026

OCR PDF uses the existing upload → preview/options → process → automatic download flow. The nine protected Merge/Split files are unchanged. Reference group 23's nine screenshots were visually reviewed; language selection is the main missing feature addressed here.

## Implementation

- Searchable selection of 41 languages, up to three per run, with pinned Apache-2.0 models served locally. The 52.9MiB model collection is loaded per selected language, not all at once. Integrity records cover each upstream model and its compressed asset. Official Tesseract.js-core 7.0.0 local LSTM builds support SIMD, relaxed SIMD and non-SIMD browsers. No dependencies were installed into the shared directory.
- Strict page selection, 150/300 DPI, up to 100MB, 2,000 total pages, 200 selected pages per run. Original pages remain; canvas rendering is limited to 20MP and 8192px per side. Stable input copies, cancellation, timeout/retry errors and blank/damaged-file recovery are retained.
- Searchable PDF, TXT and DOCX downloads; chosen format downloads automatically, with other formats available on the result screen. Recognized text, per-page confidence and empty-page notices are shown. DOCX retains RTL paragraph direction. Text exports are editable text, not a recreation of original layout.
- The PDF adds a valid embedded glyphless TrueType font and explicit Unicode mappings. Original page streams/images, annotations, forms, page geometry and dates stay intact. Original signature/certification and XFA documents are refused instead of silently invalidated.
- Corrected Arabic/Hebrew glyph order, complete phrase order, word separators and embedded digits. RTL phrases use one positioned text line so readers apply bidirectional ordering once. Chinese/Japanese token spaces between adjacent CJK letters are removed, while Latin text, numbers, Korean spaces and line breaks are retained. Their searchable layer uses complete lines; other scripts retain word boxes. Individual character highlight positions within these line boxes are approximate.
- Bundled bidi-js 1.0.3 is the unchanged official ESM distribution, verified against npm SHA-512 and accompanied by its MIT license. No external document-processing service is called.

## Verification

- Full suite: 328 passing tests. Type checking and the production build pass; lint has only the three existing crop/image warnings.

- Eleven focused tests cover image/geometry/metadata preservation; Unicode extraction including Hindi, Arabic, Hebrew, Chinese, Japanese and non-BMP characters; selected pages; real TXT/DOCX structure; active cancellation/retry; invalid language/range/resolution; signed/XFA refusal; blank/missing-position failure; model integrity; Arabic phrases with numbers; and contiguous CJK searchable phrases.
- Real browser Hindi/Arabic/English recognition selected pages 2–3 of a five-page scanned PDF. Downloaded PDF, TXT and DOCX reopened independently. PDF.js and PDFium extracted complete Arabic phrases and embedded numbers in the correct order. All five PDF pages rendered identically to the originals; unselected pages and dates remained unchanged. Pypdf's mixed RTL/numeric extraction differs from the two rendering readers, so it is not used as the sole bidi oracle.
- Chinese/Japanese multi-language recognition exercised out-of-range recovery and Cancel followed by retry. Downloaded output retained all five pages and added text only to selected pages. Recognition is imperfect; some Chinese glyphs were misrecognized by the model and the result must be reviewed. This is not a claim of certified accuracy across all 41 languages.
- At a verified 390px viewport, language search, invalid-file recovery, automatic DOCX and secondary PDF downloads worked without horizontal overflow. After reloading the updated development bundle, Japanese PDF/DOCX contained contiguous phrases such as 日本語の文字認識テスト, with every original page pixel-identical.
- The existing English OCR Image tool still downloaded readable recognized text using its unchanged default language model.

Browser proof and decoded outputs are stored outside the public repository in the local release19 files and fixtures/ocr directory. No private reference documents were uploaded for testing. No physical mobile/Safari certification, translation, handwriting accuracy or full document-layout reconstruction is claimed.

A four-page cropped scan fixture with native rotations 0/90/180/270 was processed in the browser. Every output page rendered pixel-identically to its source; PDF.js verified equivalent visible text-box alignment (within 2 points) across rotations, and PDFium recovered expected text and numbers from all four.
