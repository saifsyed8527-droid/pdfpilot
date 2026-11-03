# HTML PDF cancellation and recovery — 3 November 2026

HTML to PDF now has real cancellation between rendering tiles, during font/image waits and before output is published. The preview and settings remain available for retry. Controls stay disabled until active rendering unwinds, preventing a second conversion from overlapping the first. HTML to Image shares the improved asset-wait and temporary-frame cleanup. Only conversion-created html2canvas frames are removed, preserving pre-existing frames.

Rendering is bounded to 6,000 DOM elements, 200 PDF pages, 100 million total rendered pixels, 4-million-pixel tiles, 128MiB encoded/output data, and a cooperative 180-second PDF deadline. Existing 10,000-pixel source width, 150,000-pixel source height and 14,400-point long-page bounds remain. Oversized single pages explicitly ask the user to change settings. The error is focused and scrolled into view, including mobile. A completed result scrolls to the top. The result explains that PDF text is image-based, with supported clickable links retained. Credential-bearing links are excluded. Document-derived conversion errors remain local and masked; failure analytics use a constant description.

## Reference and checks

Reviewed all screenshots in supplied extraction groups 8 (1), 9 (16) and 27 (12). Existing URL/file import, screen-size presets, A3/A4/A5/Letter, long/standard page, Portrait/Landscape, margin choices, ad/popup removal, preview refresh and download flow remain. The reference group IDs are not verified original Docs tab IDs. Also reviewed group 28's seven PDF-to-JPG screenshots and group 49's ten translation screenshots for continuing work; this change does not implement translation.

- Six new engine tests exercise real PDF packaging with rendered tiles, safe and unsafe links, geometry, restored scrolling, cancellation at loading/rendering/progress boundaries, image event-listener cleanup, pre-existing iframe preservation, malformed settings and complexity/page/pixel limits. Existing HTML PDF and image tests pass.
- Actual browser empty HTML rejection was corrected by choosing a valid file in the same dialog.
- An eight-section, 11,200-pixel page exported to 11 standard A4 pages. Independent PDF parsing verified 11 image strips, page dimensions and all eight destination links (one crosses a page boundary and has two annotations). A separate long-page download contained one 595 × 8677.0833-point page, nine image strips and all eight links.
- A 3,232-content-element, 16,000-pixel page was cancelled at 45% rendering progress. Retry downloaded a real 15-page PDF. Independent rendering and visual inspection found Part 1 at the beginning and Part 32 with its final token at the end. No cancelled result was displayed.
- Mobile at 390 × 844 CSS pixels had no horizontal overflow. A too-tall one-page export failed clearly. The corrected UI focused the error with its bounds inside the viewport (top 332, bottom 398), then changed settings exported successfully. A 16,000-pixel source also exported as one 595 × 12395.8333-point page with 13 image strips. The result scrolled to the top with Download visible.
- Actual HTML to Image regression downloaded a 768 × 1400 PNG. Independent decoding confirmed dimensions and expected top-bar and final-background colors.
- A production-build public URL check exposed a pre-existing link error: the iframe's inherited `base-uri 'self'` policy caused relative links to use PDF Pilot's address. Source links are now resolved explicitly against the fetched URL or a valid declared HTML base, without relaxing CSP. Unresolved local links and unsafe/credential-bearing destinations are removed. Two added tests cover source paths, fragments, declared bases, Unicode paths, mail/tel and rejected destinations.
- Chrome downloaded the corrected public About page as two A4 pages (472,903 bytes). Independent parsing found all 23 annotations pointing to `https://pdfpilot.net/` paths, with no localhost destinations. Both rendered pages were visually checked, including the final footer. SHA-256: `19d8475be7637b473be006dfc0f6e0013314e33f5bb0dcc8ec01e6929b896b15`.
- All 444 tests, type checking and production build passed after the link fix. Existing unrelated image/ref lint warnings remain. All nine protected Merge/Split reference hashes are unchanged.

These checks use synthetic local content and PDF Pilot's public About page. Downloads and inspected screenshots are retained outside the published repository under audit-2026-10-29/fixtures/html-pdf-recovery and release34 evidence.

## Limits

HTML PDF pages remain image-based; this does not implement selectable HTML text, script execution, authenticated websites, exact print-CSS fidelity or translation. Long standard pages can split text lines across page boundaries. Cancellation is cooperative during html2canvas work and cannot interrupt every synchronous library call immediately. URL fetch and asset-proxy behavior was not broadened.
