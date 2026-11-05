# Shared links, connected workflows and international pages

## Delivered behavior

- Drive and Dropbox public shared links enter the existing file-selection handlers for all 109 tools. Google Docs, Sheets and Slides use supported export formats. No OAuth credentials or private-account picker is required. The server retrieves each public link; subsequent processing runs in the browser. Imports are limited to 4 MiB each and 20 links per batch where multiple inputs are supported.
- `/integrations` is generated from file-operation contracts. 29 registered adapters produce 120 supported executable pairs; the two cloud providers add 218 tool connections. Including source hubs and the root, 368 paths are available per language (4,416 URLs across 12 languages). Both steps execute, with the first output passed directly to the second.
- 269 existing resource pages now have translated server-rendered content, localized metadata, self-canonicals, reciprocal language alternatives and sitemap entries. Existing Portuguese intent URLs are retained. Resource navigation, searches and workspace controls retain the current language; file names, file contents and operation settings remain unchanged.
- The complete discoverable inventory contains 8,964 unique URLs: 4,548 home/tool/resource URLs and 4,416 connections. This is the implemented inventory, not a claim of hundreds of thousands of pages or Google indexing.

## Validation

- Full automated suite: 485 passed, zero failed. Tests include execution of every one of the 120 operation pairs, output parsing, abort/retry, malformed tables, cloud-host validation, import endpoint handling, resource dictionary coverage and localized directory rendering.
- Production build, lint and TypeScript validation passed. Four pre-existing warnings remain in compression/crop/PDF-image clients.
- A production-preview HTTP matrix fetched all 8,964 URLs: HTTP 200, correct language, self-canonical, reciprocal alternatives, H1 and no unexpected noindex or rendering errors. Root URLs with or without the trailing slash are normalized for comparison. All 109 tool pages include both import buttons.
- Real Chrome: two Dropbox PDFs imported into Merge PDF, combined and downloaded. The saved PDF contains 12 pages. A public Google Docs sample imported as a readable one-page PDF. A lookalike Google hostname was rejected and a valid retry succeeded.
- Real Chrome: CSV → JSON → Excel example downloaded as an XLSX; all records and the `Pens, blue` cell matched the input.
- Real Chrome: Russian template search returns localized links. A Russian merge-and-number workflow downloaded a five-page PDF with the correct page numbers 1–5. Arabic connection layout at 390 × 844 has RTL direction and no horizontal overflow.

## Extending the system

Add a working adapter with its input/output formats, settings and reproducible sample files to `src/lib/connections/operations.json`, implement its processing behavior in the engine, then run the complete tests and build. Compatible pairs, source listings, localized pages and sitemap chunks are generated from that registry. Unsupported and inverse conversion pairs are excluded. No arbitrary URL parameter creates an indexable page.

New resource pages must be added to the resource manifest and translated dictionaries before advertising language alternatives. Resource dictionaries were seeded with Chrome's local Translator API, followed by coverage checks and targeted terminology corrections; they have not received a native-speaker editorial review in every language. Sample file contents are intentionally preserved.

The existing source evidence hashes were refreshed only for the ten tool declarations whose clients gained shared-link buttons. Their processing behavior remained unchanged and the corresponding engine tests passed. Three affected intent-review fingerprints were refreshed without changing intent content or bypassing deployment validation.
