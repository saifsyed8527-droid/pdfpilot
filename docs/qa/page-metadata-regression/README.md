# Deferred page metadata/accessibility regression evidence

Synthetic non-sensitive fixtures; QA evidence only. No executable product changes in this evidence commit.

Candidate `c26aad2` (including `6cffe59`) introduced a Delete Pages regression for tagged inputs: original-catalog retention leaves a removed page reachable from the unpruned structure tree. `c26-delete-tagged-bad.pdf` contains two visible pages but three serialized Page objects. The removed page's structure/content remains reachable through `/StructTreeRoot` and `/Pg`.

`tagged-source.pdf` is a three-page synthetic tagged PDF: real BDC/EMC content with MCIDs, nested Document/Sect/H1/P structure, explicit Pg/MCR entries and ParentTree arrays. Delete middle page; expected output contains only source pages 1 and 3, with their accessibility structure retained and no removed page object.

`production-base-copy-tagged-untagged.pdf` reproduces the exact old `3e92891` Delete algorithm (`PDFDocument.create`, `copyPages(source,[0,2])`, `addPage`, `save`). It has only two Page objects, but no structure tree. This establishes that extra removed-page retention is introduced by the candidate, while accessibility loss is pre-existing. Candidate Extract without forms/annotations still follows the old copy path and loses tags (`c26-extract-tagged-untagged.pdf`).

`labels-source.pdf` has a real nested PageLabels number tree: Roman front matter, prefixed Arabic chapter numbering, prefixed alphabetic numbering, and a prefix-only final page. Source labels are `i, ii, Chapter-8, Chapter-9, Chapter-10, Annex-AA, Final`. Select pages 2,6,7; expected labels are `ii, Annex-AA, Final`. Candidate Delete incorrectly outputs `i, ii, Chapter-8`; candidate Extract drops labels entirely.

Reproduce the independent observations with:

```sh
node docs/qa/page-metadata-regression/inspect.cjs
```

The committed report was produced by that command using PDF.js 6.1.200 and pdf-lib 1.17.1. It includes actual page text, page labels, parsed structure trees, visible counts and serialized Page-object counts. It does not claim PDF/UA conformance or cryptographic-signature preservation.

Parent excluded the candidate semantics commits from batch 2; their original branches/history remain preserved. A separately tested tagged/label repair is required before considering those commits again. The later work-in-progress engine changes are deliberately excluded from this evidence commit.
