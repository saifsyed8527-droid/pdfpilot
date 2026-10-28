# Archive and Markdown conversion verification — 29 October 2026

## PDF/A

The old converter copied pages and wrote PDF/A identification without completing conformance conversion. The new converter creates opaque, lossless RGB image pages with an embedded ICC v2 sRGB output intent, synchronized XMP/Info metadata, a document ID and the appropriate PDF version. Source scripts, encryption, attachments, links and interactive fields are not carried into the archive. Visible form appearances are rendered. Page dimensions and rotations are handled independently from pixel resolution.

- Generated PDF/A-1b, PDF/A-2b and PDF/A-3b fixtures passed veraPDF **1.30.3** with zero failed checks. This is a development check, not an in-browser validator or a claim about every possible input.
- An actual browser download using 300 DPI and 90-degree extra rotation also passed veraPDF's 1b profile.
- Engine tests check dimensions, rotated CropBoxes, output intent, XMP, image-only content, invalid input, unsupported profiles and cancellation.
- Browser checks cover the protected-PDF error and invalid-PDF replacement/recovery. Mobile checks use a 390-pixel viewport.

Supported profiles are the visual B levels. Tagged A levels, Unicode U levels and preservation of searchable source text are not implemented. These are disclosed before conversion. The earlier options only labelled files and have been removed. Downloads intended for a specific archive should be validated by that archive's rules.

Validation tool: https://docs.verapdf.org/cli/validation/

## Markdown to PDF

The previous heading/paragraph parser silently excluded tables, lists, code and quotes. The new renderer preserves those blocks, inline bold/italic/strikethrough text, safe links and embedded PNG/JPG images. Tables wrap rather than truncate and split across pages with repeated headers. A4/Letter and portrait/landscape are available. Text remains selectable.

- A table-only Markdown fixture containing 95 rows and a long unbroken cell exported successfully through the browser; every row and the complete long cell were found in the downloaded PDF.
- Tests cover nested lists, checkboxes, safe link annotations, rejected JavaScript links, code, quotes, raw HTML as text, long cells, page bounds, Hindi and symbols, embedded images and cancellation.
- A 10,000-row conversion was cancelled in the browser and returned to the workspace without a stale result.
- Browser empty-file error followed by replacing the file with a Unicode/image Markdown fixture and downloading worked at 390 pixels without horizontal overflow.
- Remote images become labelled links and are not fetched. Raw HTML is printed as text. Unsupported font glyphs produce an error; arbitrary CSS layouts and every world script are not claimed.

Merge/Split components and their navigation flow are unchanged. No dependency changes were needed.
