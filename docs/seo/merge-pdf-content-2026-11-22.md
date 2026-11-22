# Merge PDF service-page release

The English `/merge-pdf` page now includes the supplied interactive HTML's complete below-tool flow. The existing uploader, arrangement workspace, processing and result components remain unchanged. The English introduction is supplied through the existing landing-copy prop.

## Content and design

- Content Brief v1 is the SEO authority; Service Content v1 supplies the copy; Merge-PDF.html v3 supplies layout and interactions.
- Retains one H1, the nine M02–M10 H2 sections and six H3 subheadings, on the existing canonical URL with existing language alternates.
- Adds the four-step screenshot gallery, synchronized thumbnail controls, image dialogs, reversible A/B illustration, native FAQ accordions, task recap and closing CTA. The CTA focuses the actual uploader without opening a file picker.
- Keeps each contextual link at its main placement: Organize PDF in M04, Compress PDF in M05, JPG to PDF and Split PDF in M08. The recap does not repeat those links.
- Uses only original PDFPilot screenshots and original diagrams. Three screenshots are lossless WebP assets (203,136 bytes combined); images load lazily with intrinsic dimensions. Competitor captures and internal review notes are excluded.
- Source reconciliation: the introduction is 34 words within the brief's 25–40-word direction; the missing study-handouts example is added. Illustration captions are phrased for visitors. The content remains server rendered, with client code limited to interactions.
- Uses the supplied title and meta description. Existing truthful application/breadcrumb schemas remain; no ratings or FAQ rich-result promises are added.

The current brief maps 22 accepted phrases (one primary, 21 secondary) to this single URL. It supersedes the historical 25-candidate set for this release without deleting historical research. Natural variants and semantic intent are retained; no awkward exact-match repetitions are added.

## Verification

- 19 repository SEO checks pass.
- 16 PDF-page-operation, processing-task and analytics-privacy regressions pass.
- Desktop 1440px and responsive 390px/768px checks pass without page overflow.
- Gallery/thumbnail synchronization, image-dialog Escape and focus return, file-order swap, keyboard FAQs and closing CTA pass.
- Malformed-PDF error/removal recovery passes.
- Real synthetic two-file downloads independently parsed: four pages in B1, B2, A1, A2 order after desktop Z–A sorting; A1, A2, B1, B2 on mobile. Page sizes remain 420 × 595 points.
- All four contextual destinations return HTTP 200 without redirects.
- All 43 rows of the user-supplied editorial checklist and all 22 current keyword intents are recorded in the local release evidence, with inapplicable and unmeasured items explicit.

Production build, final release and live verification are recorded separately in the release receipt. These checks do not establish Google indexing, ranking, traffic gains, field Core Web Vitals or exhaustive PDF-format compatibility.
