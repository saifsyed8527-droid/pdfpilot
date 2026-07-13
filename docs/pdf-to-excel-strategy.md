# PDF → Excel — strategy, not implementation

Written because this is the most-requested remaining conversion direction
and the one gap flagged explicitly in the Phase 2B report as "undocumented,
not just undeferred." This doc closes that gap: a real recommendation,
not a vague "we'll get to it."

## Why this doesn't already exist

`officeparser` (this project's Office-file reader) converts a source file
to Markdown/text/HTML — it does not run in the PDF→Excel direction at all;
it *reads* Office formats, it doesn't produce them. Excel to PDF works
because "read XLSX, render as PDF" fits that shape. PDF→Excel is the
opposite problem: given a PDF (which has no native concept of rows/columns,
only positioned text and drawn lines), infer a table structure and *write*
a real `.xlsx` file — a problem officeparser was never built for, and a
harder problem than any tool this project has built so far.

Two sub-problems, both real:

1. **Table detection from a PDF.** A PDF has no "table" object — what
   looks like a table is either (a) an actual PDF table/form structure
   (rare, mostly in generated reports), or (b) text items positioned to
   *look* like a grid, detectable only by clustering their x/y coordinates.
2. **Writing a real `.xlsx` file.** No XLSX-writing library is currently a
   dependency of this project (verified this sprint — neither `xlsx`
   (SheetJS) nor `exceljs` is installed; `officeparser`'s own dependency
   tree has no writer either, only a reader).

## Recommended approach

**Phase A — honest, achievable now, browser-native:**
Use the text-extraction machinery already in `pdf-text-extraction.ts`
(built on pdfjs-dist, already used by Compare PDFs and PDF to Word) to get
positioned text items per page — each item carries an (x, y) origin. Group
items into rows by clustering nearby y-values, then into columns by
clustering nearby x-values across rows on the same page. This is the same
general technique real table-extraction tools (e.g. Camelot, Tabula) use
for PDFs with no embedded table markup — imperfect on irregular layouts,
genuinely correct on the common case (a report or invoice with an
actual visual grid). Ship it labeled honestly: "detects table-like grids
by column alignment; may not correctly extract irregular or merged-cell
layouts" — the same disclosure pattern `pdf-text-renderer.ts` already uses
for its own "not layout-preserving" limitation.

**Writer**: add `xlsx` (SheetJS community edition) as a new dependency —
real, browser-compatible, the de facto standard for writing `.xlsx` from
JS, MIT-licensed, no Node-only APIs in its writer path. Needs the same
dependency-verification pass every other Phase 2B/2C addition got
(`npm view`, GitHub activity, `npm audit`) before landing — not yet done,
since this is a strategy doc, not an implementation.

**Phase B — deferred, not recommended now:** true structural table
detection (handling merged cells, multi-row headers, nested tables) is a
much larger effort with diminishing returns for a free browser tool. Not
worth building until Phase A ships and real usage shows it's the
bottleneck.

## What NOT to do

Do not ship a version that just dumps every line of extracted text into
column A of a spreadsheet and calls it "PDF to Excel" — that's technically
non-empty output but not a real table conversion, and would misrepresent
what the tool does to a user who specifically wants tabular data
preserved. If Phase A's column-clustering genuinely can't find a grid on a
given PDF, the honest behavior is an error message ("No table structure
was detected in this PDF") — the same "throw rather than fake a result"
principle every other tool in this project already follows (e.g. CSV to
PDF explicitly disclosing its scope, `pdf-text-renderer.ts`'s
not-layout-preserving disclosure).

## Effort estimate (for prioritization, not a commitment)

Comparable in scope to the OCR Image or DOCX Merge tools built in Phase
2B — one new engine module (`pdf-table-engine.ts`, following the same
naming/extraction pattern as every other engine), one new dependency
(`xlsx`), one new tool page. Not a multi-sprint effort, but real
column-clustering logic needs its own test fixtures (a PDF with an actual
visual grid, not the plain-paragraph fixtures this sprint's QA used) and
its own honest edge-case testing before it should ship.
