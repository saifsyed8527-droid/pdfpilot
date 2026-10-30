# Local OCR assets

The existing English model and Tesseract.js worker are retained for existing OCR consumers. OCR PDF offers up to three selections from 41 pinned `tessdata_fast` models in `lang-v1`. All models are fetched from the same site; selected documents are never sent for OCR.

`assets-v1.json` records the exact upstream commit, source URL, SHA-256 of every original trained-data file and its deterministic gzip, and the 572-byte glyphless TrueType font. Models and font are Apache-2.0; included licenses apply. Sources: https://github.com/tesseract-ocr/tessdata_fast and https://github.com/tesseract-ocr/tesseract .

The local Tesseract.js-core 7.0.0 LSTM distributions (SIMD, relaxed SIMD and non-SIMD) are copied unchanged from the installed official package. These files embed their own WebAssembly bytes. The worker chooses the supported implementation instead of forcing SIMD. Package license is included in LICENSE-core.

The invisible PDF text layer follows Tesseract's glyphless-font design, with explicit Unicode mappings and bidirectional ordering. It preserves page streams and adds no visible marks. This is text recognition, not translation, layout reconstruction or OCR accuracy certification for all languages.
