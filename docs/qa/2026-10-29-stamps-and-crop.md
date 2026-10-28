# Page numbering, watermark and crop verification — 29 October 2026

The exported marks previously used MediaBox dimensions without accounting for the visible CropBox or native rotation. They now draw in the visible page's coordinate system, preserving original content and native page rotation. Page labels and text watermarks use the existing bundled Unicode font support when the standard fonts cannot encode the text. Unsupported glyphs and labels that cannot fit fail explicitly.

Image watermarks now occupy 30% of visible page width before fitting, independent of source pixel resolution. Edge positions keep the rotated mark within page margins. Repeated marks fit their mosaic cells. The preview uses the same fit/position calculation and transparent source thumbnails, so the below-content option shows through unpainted page areas. Preview text metrics still depend on the browser's font, so it is not a pixel-identical export proof.

Crop output maps the visible selection directly to PDF coordinates at 0/90/180/270 degrees, including existing CropBoxes. Invalid rectangles/ranges are rejected. All three processing loops check cancellation between pages and before returning output; their clients suppress cancelled results. Preview workers are released after rendering or when replacing the crop document.

Verification:
- Eight engine tests inspect actual PDF output: all page rotations, CropBox dimensions and placement, facing pages/cover/ranges, Hindi text extraction, diagonal/edge watermark placement, image sizing, below/over layer order, cancellation and invalid input.
- The image-layer test renders both PDFs and checks actual pixel colors and watermark boundaries.
- Browser downloads of a four-page rotated document include Hindi numbering with facing pages/cover, a Hindi watermark below the original content, and a large image watermark on a 390-pixel viewport.
- Browser-drawn crop dimensions match the downloaded PDF on all four rotated pages. Hindi downloads were independently parsed and rendered with pypdf and PDFium.
- Crop mobile overflow was reproduced on a rotated landscape page and fixed; the refreshed browser reports a 390-pixel viewport and 390-pixel document width. Initial fit runs after the viewer mounts.
- Accessible names were added to font, format and style controls. Merge/Split's reference components and interaction flow are unchanged.

Cropping still changes visible bounds only, and watermarking is visual. Neither operation is secure redaction. Existing source content, including older page numbers, remains intact.
