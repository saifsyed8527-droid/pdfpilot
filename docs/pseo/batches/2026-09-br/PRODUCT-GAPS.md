# Product gaps: evidence and engineering decisions

No capability below was implemented in this SEO batch. Feasibility is an engineering assessment from existing code, not a delivery estimate. Exact raw market values and source-row IDs are in the JSON. No cross-country sums, synonym sums, global KD or opaque opportunity score are used.

| Gap | Effort assessment | US strongest observed query | IN | BR |
|---|---|---|---|---|
| HEIC to PDF | Relatively feasible | heic to pdf (40500) | heic to pdf (14800) | heic para pdf (2400) |
| PDF text extraction | Relatively feasible | pdf to text converter (3600) | pdf to text converter (22200) | pdf to txt (1600) |
| PDF to PNG | Relatively feasible | pdf to png (74000) | No validated observation in this export | pdf to png (110/33100) |
| Portuguese OCR | Moderate | No validated observation in this export | No validated observation in this export | ocr em pdf (590) |
| Text/Markdown to PDF | Moderate | md to pdf (12100) | text to pdf converter (60500) | transformar texto em pdf (4400) |
| Other gaps / manual scope review | Research first | sign pdf (12100) | sign pdf (22200) | como assinar um documento em pdf (4400) |
| PDF to XML | Research first | No validated observation in this export | No validated observation in this export | pdf para xml (9900) |
| Target-size compression | Major reliability work | pdf compressor to 200kb (880) | compress pdf to 200kb (165000) | comprimir pdf para 1mb grátis (590) |
| Legacy Office formats | Major engineering | doc to pdf (18100) | doc to pdf converter (823000) | conversor de ppt para pdf (720) |
| PDF to EPUB | Major engineering | No validated observation in this export | No validated observation in this export | converter pdf em epub (18100) |
| Document translation | Major product | english to hindi translate in pdf (22200) | pdf translate english to hindi (14800) | tradutor pdf (5400) |
| PDF protection/unlock | Major security/compatibility work | unlock pdf (12100) | unlock pdf (450000) | desbloquear pdf (27100) |

## HEIC to PDF

Reuse existing non-public HEIC decoder only after browser memory and image-orientation QA; connect to the real PDF image pipeline.

## PDF text extraction

Expose text extraction already used by converters, with page order, Unicode and empty-scan detection; OCR language support remains separate.

## PDF to PNG

Reuse PDF rasterization, add PNG output and memory limits. Verify multipage archive naming, resolution and transparency.

## Portuguese OCR

Add Portuguese language data, language selection, Unicode output and real Brazilian scans; benchmark accuracy and memory.

## Text/Markdown to PDF

Adapt supported HTML rendering with safe Markdown parsing, font coverage, pagination and offline asset handling.

## Other gaps / manual scope review

Includes unsupported or out-of-scope tasks. These are observations, not approved features or page opportunities.

## PDF to XML

Clarify generic XML versus fiscal/invoice schema intent. A file extension alone does not identify the required schema.

## Target-size compression

Build iterative size targeting with explicit quality floors and a failure result when the target is unattainable; do not promise every file reaches an exact size.

## Legacy Office formats

Older binary DOC/PPT/XLS need format-specific parsers/renderers or a disclosed server conversion service. Validate whether each keyword means a literal binary format or colloquial Office export before investing.

## PDF to EPUB

Reading order, reflow, headings, images and EPUB validation cannot be inferred from plain PDF extraction.

## Document translation

Translation models, document layout, privacy, cost and quality assurance are separate product work; high demand is not current capability.

## PDF protection/unlock

Define supported authorized password workflows, encryption compatibility, malformed-file handling and key/privacy model before any public promise.

## Recommended sequence

First evaluate PDF-to-PNG, text extraction and HEIC-to-PDF against real files; they reuse more existing code. Portuguese OCR then unlocks a meaningful language constraint. Treat exact-size compression, legacy Office conversion and document translation as separate engineering projects with explicit acceptance criteria. Keep English scanned PDF-to-Word supported and unchanged. Do not interpret the BR query “pdf para xml” as an invoice converter without interviewing users and checking ranking URLs.
