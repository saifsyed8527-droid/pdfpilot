# Local PDF translation — 3 November 2026

Adds the 109th public tool, Translate PDF, to the existing catalog and Edit PDF navigation. The upload, preview/options, processing and automatic/repeat-download flow matches the existing tool shell. The supplied reference's extraction group 49 (all ten screenshots across two sheets) informed source/target language search, swapping, same-language rejection, translation and download. Group IDs are not verified original Google Docs tab IDs.

The tool uses the browser's built-in Translator API, with pair availability checked on the device. The menu includes 39 languages; this does not certify every pair or browser. It supports selected pages, Auto/Free OCR/No OCR, OCR language selection, and PDF/DOCX/TXT outputs with optional original text and per-page review. Documents and extracted text are not uploaded for translation. Browser-managed language packs download on first use. No paid API or API key was introduced.

Limits: one non-empty PDF up to 100MiB, up to 50 selected pages out of a 2,000-page source, 200,000 source characters, 1,500 UTF-16-unit model chunks, one million translated characters, 100MiB output and a cooperative ten-minute overall deadline. PDF output has a 500-page bound. OCR uses the existing 41-language assets and 16-megapixel page raster limit. Cancellation aborts the translator and extraction, releases the instance, prevents stale output, and retains the file/settings. A deadline now raises an error even when the cancelled extractor returns no result; it cannot fall through to a success notification.

PDF to Word now exposes its existing extraction/OCR stage separately for reuse. Its conversion wrapper, DOCX behavior and original limits remain. The optional translation page cap is checked before native page extraction or starting OCR. Shared capability evidence hashes and their matching existing review fingerprints were refreshed after regression checks; no new localized-page approvals were added.

## Download and browser checks

All source documents below are synthetic fixtures.

- Real desktop Chrome Translator API converted a two-page English PDF to Hindi. Downloaded PDF had two A4 pages, the meeting time and order `0012`/amount `125`; both pages were independently rendered and visually checked.
- Source/target search and swap worked. Choosing the same language showed an error and disabled translation. Arabic DOCX export of selected page 2 contained only source page 2, optional original English, the Arabic translation and Word RTL paragraph/run properties. Its actual downloaded ZIP/XML was inspected (8,805 bytes).
- An image-only two-page PDF used Auto OCR and downloaded Hindi TXT (451 bytes), with both source-page markers, the complete recognized sentences and retained numbers. The result disclosed OCR use. Empty-file and corrupt-PDF errors produced no result; the same flow recovered with a valid scan.
- A 40-page PDF was cancelled while translating source page 5 at 41%. No partial result appeared; file/settings remained. Retrying only page 40 downloaded a 7,941-byte bilingual TXT. Original and translated text included all 38 sentences, including the last sentence and page number.
- At 390 × 844 CSS pixels there was no horizontal overflow. A 51-page selection failed with the 50-page limit; the error received focus and was inside the viewport (top 571, bottom 625). Selecting page 51 recovered and downloaded one Arabic PDF page. The completed result scrolled to the top with Download visible. This is a desktop-browser viewport test, not mobile translation support.

## Unicode output correction

Independent decoding exposed a real problem in the initial translated PDFs: shaped Hindi/Arabic glyphs looked correct but some copy/search text was wrong. Arabic shaping can use the same base glyph for different source letters, and some readers ignore ActualText spans.

The translated PDF now paints reusable vector glyph outlines and supplies a separate, explicitly mapped logical Unicode text layer. Reused Form XObjects avoid repeating glyph paths for every occurrence. Font shaping, offsets, wrapping and RTL positioning are retained. Plain Latin-only output keeps ordinary PDF text. This new path is selected only by the translation exporter; existing editor export behavior is unchanged. PDF selection boxes follow the line rather than each glyph contour.

Regression PDFs were decoded by both PDF.js and PDFium. Full Hindi, Arabic (including contextual letter collisions and mixed digits), Bengali, Thai, Japanese and Hebrew text matched the source strings, with no duplicated visible-glyph text. All six rendered pages were visually checked. One additional decoder, pypdf, has mixed-RTL extraction limitations on these lines; no claim is made that every third-party extractor reconstructs mixed-direction text identically. The DOCX and TXT outputs retain logical Unicode directly.

## Remaining limits and sources

This release provides text translation. Original columns, tables, pictures, exact typography and visual page layout are not reconstructed. It does not implement the reference's layout-preserving mode or a separate advanced AI tier. Auto OCR reads pages without native text; force OCR to include text inside captioned images. Machine translation and OCR can change meaning; the tool asks users to review names, numbers and important wording. PDF export suggests Word/Text when the font repertoire cannot represent a character.

Chrome 138+ and Edge 148+ desktop support is based on [Chrome's Translator API documentation](https://developer.chrome.com/docs/ai/translator-api) and [Microsoft's Translator API documentation](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/translator-api). The implementation follows the activation and cancellation behavior described in [Translator.create](https://developer.mozilla.org/en-US/docs/Web/API/Translator/create_static) and [Translator.translate](https://developer.mozilla.org/en-US/docs/Web/API/Translator/translate). Safari, Firefox and mobile translation are not supported by this implementation. Language-pack download and API availability depend on the user's browser/device.

Evidence is retained outside the published repository under audit-2026-10-29/fixtures/translation and release35 screenshots/logs. The private competitor document and its embedded personal data are not published.

Final verification: all 451 tests and the production build (588 generated pages, including the new route) passed, with no new type/lint errors. Existing unrelated lint warnings remain. All nine protected Merge/Split source hashes are unchanged. The built application downloaded a corrected two-page Hindi PDF (1,399,110 bytes; SHA-256 `b2df868d1de99e657500f9fe7a19140f7609a1aee996616bf07448ebd511d9ef`). Independent PDFium decoding recovered the complete Hindi order/amount/receipt sentence, and its rendered second page was checked. The built application also downloaded and independently decoded the complete Arabic sentence with `0012` and `125`; its rendered output was checked.
