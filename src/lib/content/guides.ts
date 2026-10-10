import type { BaseContentEntity } from "./types";

export interface GuideEntity extends BaseContentEntity {
  type: "guide";
  /** Body copy as paragraphs — deliberately plain strings, not a rich content
   *  format, since a single seed guide doesn't justify more machinery yet. */
  body: string[];
}

/**
 * Seed content proving the Growth Architecture end-to-end. The facts here
 * are drawn directly from compress-pdf's actual implementation (canvas
 * rasterization to JPEG, per-quality scale/jpegQuality settings) and the
 * FAQ already shipped on that page — nothing invented.
 */
export const GUIDES: readonly GuideEntity[] = [
  {
    type: "guide",
    id: "guide-how-pdf-compression-works",
    slug: "how-pdf-compression-works",
    path: "/guides/how-pdf-compression-works",
    title: "How PDF Compression Works",
    description:
      "Learn how PDFPilot reduces PDF file size, choose a compression setting, and check readability, searchable text and the final download size.",
    related: [{ type: "tool", id: "tool-compress-pdf" }],
    body: [
      "PDFPilot reduces PDF file size by making an image of each page and rebuilding the document from those images. This can help with scanned or photo-heavy PDFs. It is not a lossless optimizer: a smaller result trades some detail and document features for fewer bytes.",
      "Add your PDF to Compress PDF and start with Recommended Compression. Use Less Compression when small text or diagrams need more detail. Extreme Compression uses lower-resolution page images and stronger JPEG compression; check the result before choosing it for an application, assignment or attachment.",
      "The tool compares its candidate with the original. If the candidate is the same size or larger, it keeps the original bytes unchanged. An already-efficient text PDF may therefore show no reduction. Repeating the same attempt cannot guarantee a smaller file or an exact KB target.",
      "A smaller, rasterized result no longer contains the original selectable text, interactive form fields or clickable links. Keep your source PDF. If searchable text or working forms matter, try removing unnecessary pages or exporting a smaller PDF from the source application before choosing raster compression.",
      "Open the downloaded PDF and compare its page count, page order, smallest text, diagrams and file size with the original. Check the actual upload or attachment limit you need to meet. If the file is still too large, send fewer pages with Extract PDF Pages or split it into separate documents when the recipient accepts multiple files.",
      "Your PDF is processed in your browser. Keep the tab open until processing and download finish; large image-heavy documents can take more time and device memory.",
    ],
  },
  {
    type: "guide",
    id: "guide-lossy-vs-lossless-pdf-compression",
    slug: "lossy-vs-lossless-pdf-compression",
    path: "/guides/lossy-vs-lossless-pdf-compression",
    title: "Lossy vs. Lossless PDF Compression Explained",
    description:
      "Understand the difference between lossy and lossless compression, and which approach PDFPilot's Compress PDF tool actually uses.",
    related: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "guide", id: "guide-how-pdf-compression-works" },
      { type: "help", id: "help-why-cant-i-select-text-in-compressed-pdf" },
    ],
    body: [
      "Lossless compression reduces storage without discarding the information being compressed. Lossy compression removes some detail to reduce size further. A PDF can contain text, fonts, vector drawings and several kinds of images, so the result depends on its contents and the method used.",
      "PDFPilot uses a lossy, page-image method. It renders every page and encodes a JPEG image. Extreme Compression uses scale 0.6 and JPEG quality 0.5; Recommended Compression uses 0.8 and 0.7; Less Compression uses 1.0 and 0.92. These are implementation settings, not promises of a particular percentage reduction.",
      "When the resulting PDF is smaller, each output page is an image. Original searchable text, interactive forms and links are not preserved in that rasterized output. A visually sharp page is therefore not the same thing as a document with its original text and structure.",
      "If that image-based candidate is not smaller, PDFPilot returns the original bytes unchanged. This size check matters for text-heavy files, where rasterization can cost more space than the original text and fonts.",
      "Use Less Compression when visual detail matters and inspect small text at normal reading size. Keep the original if you need searchable or editable content. Removing unnecessary pages or adjusting the source application’s export settings may reduce size without converting each page to an image. PDFPilot processes the local PDF in your browser.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-pdf-merging-works",
    slug: "how-pdf-merging-works",
    path: "/guides/how-pdf-merging-works",
    title: "How PDF Merging Works",
    description:
      "Understand how PDFPilot combines multiple PDF files into one document, and what happens to your files' pages and order along the way.",
    related: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "guide", id: "guide-merge-multiple-pdfs-without-losing-quality" },
      { type: "help", id: "help-why-are-my-pdfs-not-merging" },
    ],
    body: [
      "Merging combines the pages of two or more PDF files into a single new document, in the order the files are arranged. PDFPilot builds this new document by copying every page from each source file, one file at a time, into a fresh PDF — nothing is re-rendered or re-encoded, so page content, formatting, and image quality are preserved exactly as they were in the originals.",
      "The order files are merged in is the order they appear in your upload list — you can drag and drop files into the order you want before merging, and the final document follows that same sequence: all pages from the first file, then all pages from the second, and so on.",
      "Because merging only copies existing pages rather than rebuilding them, it can fail if a source file itself can't be opened — for example, if it's corrupted or password-protected. If a merge fails, the most common cause is one of the files, not the tool itself.",
      "For this tool, merging happens entirely in your browser. Your files are never uploaded to a server.",
    ],
  },
  {
    type: "guide",
    id: "guide-merge-multiple-pdfs-without-losing-quality",
    slug: "merge-multiple-pdfs-without-losing-quality",
    path: "/guides/merge-multiple-pdfs-without-losing-quality",
    title: "Merge Multiple PDFs Without Losing Quality",
    description:
      "Merging shouldn't degrade your files. Here's why PDFPilot's Merge PDF keeps every page exactly as it was, and how that's different from compression.",
    related: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "guide", id: "guide-how-pdf-merging-works" },
      { type: "guide", id: "guide-how-pdf-compression-works" },
      { type: "tool", id: "tool-compress-pdf" },
    ],
    body: [
      "Merging PDFs doesn't inherently reduce quality, because PDFPilot's Merge PDF tool doesn't re-render anything — it copies each page directly from your source files into a new document. Text stays selectable, images stay at their original resolution, and vector graphics stay exactly as sharp as they were before.",
      "This is different from compression, which intentionally rebuilds each page as a lower-resolution image to reduce file size. Merging and compressing solve different problems: merging combines files without changing their content, while compression shrinks a file at the cost of turning pages into images. If you need both — a single combined file that's also smaller — merge first, then compress the result.",
      "The one thing that does affect the final file's size is simply how much content you're combining: merging five 2MB files produces a file close to 10MB, because all the original page data is retained. That's expected, not a quality loss — the pages are the same as they were, there are just more of them.",
      "For this tool, merging happens entirely in your browser, and your files are never uploaded to a server.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-pdf-splitting-works",
    slug: "how-pdf-splitting-works",
    path: "/guides/how-pdf-splitting-works",
    title: "How PDF Splitting Works",
    description:
      "Choose custom ranges, fixed page groups, selected pages or file-size splitting. Preview the result and choose separate PDFs or one combined selection.",
    related: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "guide", id: "guide-how-to-choose-page-ranges-when-splitting-a-pdf" },
      { type: "help", id: "help-why-did-splitting-my-pdf-create-multiple-files" },
    ],
    body: [
      "Split PDF turns one document into smaller PDFs by copying its pages. The standard range and page modes preserve page content without rasterizing it. You choose which pages belong in each output before downloading.",
      "In Range → Custom, enter a From and To page for each range. For example, ranges 1–3, 5–5 and 7–9 produce three PDFs when “Merge all ranges in one PDF file” is off. Turn that option on to download one PDF containing those ranges in the order listed.",
      "Range → Fixed groups pages into chunks. With 10 source pages and 3 pages per file, the output groups are 1–3, 4–6, 7–9 and 10. The final group can be shorter. Use Pages to extract every page separately or select only the pages you need; selected pages can also be merged into one output.",
      "Size mode tries to group pages under the KB or MB limit you enter. A single page may exceed the limit by itself, in which case the tool reports a warning. Optional compression changes pages into images and can lose selectable text, so use it only when that trade-off is acceptable.",
      "Check the thumbnails, selected ranges and expected output count. From and To must be whole page numbers within the document, and the start cannot exceed the end. Open your downloads to check page order and any forms or bookmarks you rely on. Processing happens in your browser.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-to-choose-page-ranges-when-splitting-a-pdf",
    slug: "how-to-choose-page-ranges-when-splitting-a-pdf",
    path: "/guides/how-to-choose-page-ranges-when-splitting-a-pdf",
    title: "How to Choose Page Ranges When Splitting a PDF",
    description:
      "Select PDF page ranges with From and To fields, combine ranges into one file, or split a document into equal page groups.",
    related: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "guide", id: "guide-how-pdf-splitting-works" },
    ],
    body: [
      "Add your document to Split PDF, then choose Range and Custom. The first range starts as the whole document. Change its From and To fields to the first and last page you want to keep; use the PDF’s page positions, which can differ from page numbers printed on the document.",
      "To save pages 1–3, page 5 and pages 7–9, add three ranges: From 1 to 3, From 5 to 5, and From 7 to 9. Leave “Merge all ranges in one PDF file” off for three separate PDFs. Turn it on for one seven-page PDF containing those selections.",
      "Ranges are processed in the order listed. If you select the same page in more than one range, it appears in each corresponding output; when ranges are merged, overlapping pages can be repeated. Review the page preview before downloading.",
      "The form rejects blank fields, fractions, page zero, a start after the end, and numbers beyond the document’s page count. Correct the highlighted range before running the split.",
      "For evenly sized groups, switch to Range → Fixed and enter pages per file. To choose individual pages instead of ranges, use Pages → Select pages and review the selection. Its “Merge extracted pages into one PDF file” option controls whether the selection becomes one document or separate page files.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-pdf-to-jpg-conversion-works",
    slug: "how-pdf-to-jpg-conversion-works",
    path: "/guides/how-pdf-to-jpg-conversion-works",
    title: "How PDF to JPG Conversion Works",
    description:
      "Export complete PDF pages or extract embedded images. Choose JPG or PNG, set 150 or 300 DPI, and check the downloaded images.",
    related: [
      { type: "tool", id: "tool-pdf-to-jpg" },
      { type: "guide", id: "guide-what-resolution-are-pdf-to-jpg-images" },
      { type: "help", id: "help-why-did-i-get-multiple-images-from-one-pdf" },
    ],
    body: [
      "PDFPilot offers two different image tasks. Full pages renders the visible PDF page, including its text, diagrams and photos, into one image. Embedded images extracts supported raster pictures stored inside the PDF without creating a screenshot of the whole page.",
      "For Full pages, choose High detail · 300 DPI or Smaller files · 150 DPI. Choose JPG for a lossy image format or PNG for lossless pixel encoding. Neither format keeps PDF text selectable or adds detail missing from the original scan.",
      "Review the page selection and preview before exporting. Each selected page produces an image; multiple images are delivered together in a ZIP. If you only need a few pages from a long PDF, select those pages to reduce the job size.",
      "Embedded images keeps decoded native image dimensions. It does not recreate the page layout, cropping, placement, vector drawings or standalone stencil masks. An image can therefore look different outside the PDF. If there are no extractable raster images, use Full pages when you need a picture of the visible page.",
      "Processing runs in your browser. The tool limits an image to 24 million pixels and total output to 256 MB. If a job exceeds those limits, choose fewer pages or explicitly select 150 DPI; the tool does not silently lower your chosen resolution.",
    ],
  },
  {
    type: "guide",
    id: "guide-what-resolution-are-pdf-to-jpg-images",
    slug: "what-resolution-are-pdf-to-jpg-images",
    path: "/guides/what-resolution-are-pdf-to-jpg-images",
    title: "What Resolution Are PDF to JPG Images?",
    description:
      "Compare PDF-to-image export at 150 and 300 DPI, calculate pixel dimensions, and understand the limits of embedded-image extraction.",
    related: [
      { type: "tool", id: "tool-pdf-to-jpg" },
      { type: "guide", id: "guide-how-pdf-to-jpg-conversion-works" },
    ],
    body: [
      "In Full pages mode, PDFPilot lets you choose 300 DPI for more detail or 150 DPI for smaller files. The image’s pixel dimensions depend on both that setting and the PDF page’s physical size.",
      "The calculation is page width or height in inches multiplied by the selected DPI. A US Letter page is 8.5 × 11 inches, so an unrotated page exports at 2550 × 3300 pixels at 300 DPI or 1275 × 1650 pixels at 150 DPI. Rotation swaps width and height; unusual page dimensions produce different results.",
      "Doubling DPI makes twice as many pixels along each side and four times as many pixels overall. It does not necessarily make a file exactly four times larger, because image format, page detail and compression affect its byte size.",
      "Choose JPG when smaller image files are useful, or PNG when you want lossless encoding of the rendered pixels. A higher DPI does not recover detail absent from a low-resolution scan. Inspect the output at its intended display or print size.",
      "The DPI choice applies to full-page rendering. Embedded images are extracted at their decoded native dimensions instead. That mode does not reproduce their placement or crop on the page. Very large exports stop at the tool’s safety limits rather than silently reducing resolution.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-jpg-to-pdf-conversion-works",
    slug: "how-jpg-to-pdf-conversion-works",
    path: "/guides/how-jpg-to-pdf-conversion-works",
    title: "How JPG to PDF Conversion Works",
    description:
      "Understand how PDFPilot turns your JPG and PNG images into a single PDF document.",
    related: [
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "guide", id: "guide-does-jpg-to-pdf-resize-my-images" },
      { type: "help", id: "help-can-i-reorder-my-images-before-converting-to-pdf" },
    ],
    body: [
      "JPG to PDF accepts JPG, JPEG and PNG files. Add your images, then arrange their thumbnails in the order you want the PDF pages to appear. You can drag to reorder, sort by filename and rotate individual images before conversion.",
      "Choose image-sized pages, A4 or Letter. Image-sized pages follow each image’s proportions. A4 and Letter give you a standard paper size; choose portrait or landscape if you want a consistent orientation. Set margins and inspect the page previews.",
      "The converter embeds the images and scales their placement to fit the available page area while preserving their aspect ratios. It centers them within the margins rather than stretching or cropping them to fill the sheet. The original image files remain unchanged.",
      "Choose whether to merge the images into one PDF or create separate PDFs. Open the downloads and check page order, orientation and readability. A photo of text remains an image: this conversion does not recognize the text with OCR.",
      "Conversion runs in your browser, without uploading the images to a processing server. Keep the source files so you can change page settings and export again.",
    ],
  },
  {
    type: "guide",
    id: "guide-does-jpg-to-pdf-resize-my-images",
    slug: "does-jpg-to-pdf-resize-my-images",
    path: "/guides/does-jpg-to-pdf-resize-my-images",
    title: "Does JPG to PDF Resize My Images?",
    description:
      "Choose image-sized, A4 or Letter PDF pages. Learn how orientation, margins and image fitting affect your JPG-to-PDF output.",
    related: [
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "guide", id: "guide-how-jpg-to-pdf-conversion-works" },
    ],
    body: [
      "PDFPilot can change the size at which an image appears on a PDF page without changing the original image file. The output depends on the page size, orientation and margin settings you choose.",
      "Image-sized pages follow the image’s proportions. Photos with different dimensions or orientations can produce different page sizes. For regular printing, choose A4 or Letter and an explicit portrait or landscape orientation to make the sheets consistent.",
      "The image is fitted inside the page’s available area, with its aspect ratio preserved. Margins reduce that area. A landscape image on a portrait sheet may leave empty space above and below; the converter does not stretch the image or crop it to fill the page.",
      "Use the thumbnails to review rotation and fit before converting. If the output looks too small, try another orientation or narrower margins. Increasing the physical page size does not create detail that was missing from a low-resolution image.",
      "Your original files stay unchanged, and processing happens in your browser. Export a new copy with different settings if the first result does not match your printing or submission needs.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-csv-excel-xml-conversion-works",
    slug: "how-csv-excel-xml-conversion-works",
    path: "/guides/how-csv-excel-xml-conversion-works",
    title: "How CSV, Excel, and XML Conversion Works",
    description:
      "Understand the exact XML structure PDFPilot's CSV/Excel/XML tools produce and expect, and the real limitations to know about before you convert.",
    searchIntent: "informational",
    difficulty: "intermediate",
    related: [
      { type: "tool", id: "tool-csv-to-xml" },
      { type: "tool", id: "tool-xml-to-csv" },
      { type: "tool", id: "tool-excel-to-xml" },
      { type: "tool", id: "tool-xml-to-excel" },
    ],
    body: [
      "All four of PDFPilot's CSV/Excel/XML tools share one XML structure: <rows><row><ColumnName>value</ColumnName>...</row></rows> — one <row> element per spreadsheet row, and one child element per column, named after that column's header. This is a deliberate, generic, documented shape, not a guess at any specific accounting or ERP system's proprietary schema.",
      "Column headers are sanitized into valid XML element names when converting to XML: spaces become underscores, punctuation is stripped, and a name that would start with a digit gets an underscore prefix. A header that sanitizes to nothing usable falls back to a positional name like field_2.",
      "Converting the other direction (XML to CSV or XML to Excel) expects that exact same structure back. Column order and names are taken from the first <row> element — a later row missing one of those fields produces an empty cell rather than shifting the other columns, and XML that doesn't match this shape produces a clear error rather than a guess.",
      "Excel to XML only converts the first sheet with data in a workbook — a real, disclosed limitation, not a bug. A multi-sheet workbook needs a per-sheet output shape this tool doesn't build, since concatenating rows from sheets with different columns would corrupt the data rather than preserve it.",
      "XML to Excel produces a genuine, valid .xlsx file with one sheet — plain data only, with numeric-looking values stored as real numbers and everything else as text. There's no formatting, formulas, or multiple sheets, since the source XML doesn't carry that information either.",
      "For this tool, all four conversions happen entirely in your browser. Your file is never uploaded to a server.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-heic-photo-conversion-works",
    slug: "how-heic-photo-conversion-works",
    path: "/guides/how-heic-photo-conversion-works",
    title: "How HEIC Photo Conversion Works",
    description:
      "Understand what actually happens when PDFPilot converts an iPhone HEIC photo into a JPG or PNG, and why the browser can't just open a HEIC file directly.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [
      { type: "tool", id: "tool-heic-to-jpg" },
      { type: "tool", id: "tool-heic-to-png" },
      { type: "learning-resource", id: "learning-resource-what-is-heic" },
    ],
    body: [
      "HEIC (High Efficiency Image Container) is the default photo format on iPhones running iOS 11 or later. It compresses better than JPG for the same visual quality, which is exactly why Apple made it the default — but most browsers, and a lot of software outside Apple's own ecosystem, can't decode it natively.",
      "PDFPilot's HEIC to JPG and HEIC to PNG tools decode the file using a real HEIC/HEIF decoder (built on libheif, the same open-source decoding library used by several other HEIC tools) compiled to WebAssembly, so the actual decoding happens in your browser rather than on a server. The decoded image is then re-encoded as a standard JPG or PNG.",
      "The first time you use either tool in a browser session, the decoder itself (a WebAssembly module) has to be loaded — after that it's cached, so later conversions in the same session are faster. Your photo itself is never uploaded anywhere; only the decoder code is a network request.",
      "Choosing between the two outputs is straightforward: JPG is smaller and universally supported, the more practical default for sharing or uploading. PNG is lossless and supports transparency, at the cost of a larger file — worth it only if you specifically need pixel-perfect fidelity or transparency, neither of which a HEIC photo actually has to begin with.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-image-watermarking-works",
    slug: "how-image-watermarking-works",
    path: "/guides/how-image-watermarking-works",
    title: "How Image Watermarking Works",
    description:
      "Understand exactly how PDFPilot draws a text watermark onto a photo, what the position and opacity settings control, and what tiled watermarking actually does.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [{ type: "tool", id: "tool-image-watermark" }],
    body: [
      "Image Watermark draws your text directly onto the image's own canvas using the browser's 2D drawing API — the same technology every other image tool on PDFPilot uses to decode and re-encode photos. Nothing is overlaid as a separate layer; the watermark becomes part of the image's actual pixels, the same way it would if you'd edited it in any image editor.",
      "Font size scales automatically with the image's dimensions — set as a percentage of the image's shorter side, rather than a fixed pixel size — so the same setting produces a legible watermark whether you upload a 400px thumbnail or a 4000px photo.",
      "The five fixed positions (center and each corner) place one instance of your text with a margin from the edge. Tiled is different: it repeats the text diagonally across the entire image at a -30 degree angle, the same style used for proof watermarking, specifically because a single corner watermark is trivial to crop out, while a diagonal tiled pattern covers the whole frame.",
      "Opacity is a straightforward transparency setting from 5% (barely visible) to 100% (fully solid) — lower values keep more of the underlying photo visible through the text, useful when the watermark is there to deter reuse rather than to be the focal point.",
      "For this tool, watermarking happens entirely in your browser. Your image is never uploaded to a server.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-pdfpilots-data-format-tools-fit-together",
    slug: "how-pdfpilots-data-format-tools-fit-together",
    path: "/guides/how-pdfpilots-data-format-tools-fit-together",
    title: "How PDFPilot Data Format Tools Work Together",
    description:
      "PDFPilot's data-format tools all convert around one shared internal shape. Understanding that shape explains what each tool can and can't do.",
    searchIntent: "informational",
    difficulty: "intermediate",
    related: [
      { type: "tool", id: "tool-json-to-csv" },
      { type: "tool", id: "tool-csv-to-json" },
      { type: "tool", id: "tool-csv-to-sql" },
      { type: "tool", id: "tool-json-to-excel" },
    ],
    body: [
      "JSON to CSV, CSV to JSON, JSON to Excel, Excel to JSON, TSV to CSV, CSV to TSV, TSV to Excel, Excel to TSV, SQL to CSV, CSV to SQL, SQL to JSON, and JSON to SQL all convert around the exact same internal shape: a header row of column names, followed by data rows — the same \"rows\" model this project's CSV/Excel/XML tools have used since they first shipped. That's why any of these formats can convert to any other: they're all just different serializations of the same underlying table.",
      "This shared shape is also what defines each tool's honest scope. JSON tools expect a flat array of objects, e.g. [{\"Name\":\"Alice\"}, ...] — not arbitrary nested JSON, since a deeply nested object graph has no single obvious table shape to convert into. SQL tools read and write INSERT INTO table (columns) VALUES (...) statements specifically — the format a database export or seed script uses to represent literal data — not SELECT queries, schema definitions, or any other kind of SQL statement.",
      "Numbers and types are handled consistently, too: CSV, TSV, and SQL have no native way to mark a value as \"this is a number\" versus \"this is text that happens to look like a number,\" so these tools infer it from the text itself at read time, and every value round-trips as a string unless the target format (Excel, SQL) has a genuine numeric cell type to write it into.",
      "Knowing this shared model also explains the tools' real, disclosed limits: Excel-reading tools only read a workbook's first sheet (use Excel Sheet Extractor first for a specific sheet from a multi-sheet file), and every multi-statement SQL file must use one consistent column list throughout, the same way CSV Merger requires matching headers across files.",
    ],
  },
  {
    type: "guide",
    id: "guide-understanding-yaml-and-json",
    slug: "understanding-yaml-and-json",
    path: "/guides/understanding-yaml-and-json",
    title: "Understanding YAML and Its Relationship to JSON",
    description:
      "Learn how YAML and JSON represent objects, arrays, strings, and numbers, what differs between their syntax, and when to use each data format.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [
      { type: "tool", id: "tool-yaml-to-json" },
      { type: "tool", id: "tool-json-to-yaml" },
      { type: "learning-resource", id: "learning-resource-what-is-yaml" },
    ],
    body: [
      "YAML and JSON can represent exactly the same data — nested objects, arrays, strings, numbers, booleans, and null — because YAML was designed as a superset of JSON's data model with more readable syntax on top: indentation instead of braces, and no requirement to quote most strings.",
      "PDFPilot's YAML to JSON and JSON to YAML tools use a real, mature YAML library (js-yaml) to parse and generate both directions, not a hand-rolled approximation — YAML's real grammar includes anchors, aliases, and several scalar-quoting styles that a simplified parser would get wrong on real-world files.",
      "Because the two formats share the same data model, nothing is lost converting in either direction: a deeply nested YAML config file converts to an equally nested JSON structure, and vice versa. This is different from this project's CSV/Excel/SQL tools, which are deliberately scoped to flat, tabular data — YAML and JSON conversion has no such restriction, since neither format is inherently tabular.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-text-based-files-convert-to-pdf",
    slug: "how-text-based-files-convert-to-pdf",
    path: "/guides/how-text-based-files-convert-to-pdf",
    title: "How Text, Markdown & CSV Convert to PDF",
    description:
      "Learn how PDFPilot converts TXT, Markdown, and CSV files to PDF, how the shared layout engine handles content, and which limitations to expect.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [
      { type: "tool", id: "tool-txt-to-pdf" },
      { type: "tool", id: "tool-markdown-to-pdf" },
      { type: "tool", id: "tool-csv-to-pdf" },
    ],
    body: [
      "TXT to PDF, Markdown to PDF, and CSV to PDF all build their output using the same layout engine, so they share the same fixed page format: US Letter size (612×792 points, 8.5×11 inches) with consistent margins. This is a text-flow renderer, not a layout-preserving one — it's built to lay text out cleanly, not to reproduce pixel-perfect formatting from the source file. Content automatically flows onto additional pages as it fills each one.",
      "TXT to PDF treats each blank-line-separated block of your file as its own paragraph, collapses any extra whitespace within it, and renders it at a standard paragraph size. Markdown to PDF goes a step further: it runs your file through a real Markdown parser (the `marked` library's token lexer) and recognizes headings (#, ##, ###) and paragraphs specifically, rendering headings larger and bold. Everything else Markdown supports — lists, tables, links, images, code blocks — is intentionally not rendered; this tool's scope is headings and paragraph text, not full document layout.",
      "CSV to PDF takes a different path: instead of flowing text into paragraphs, it draws your data as a ruled table with equal-width columns, using your file's first row as the header. If the table spans more than one page, the header row is redrawn at the top of each new page so a split table still reads correctly. Because every column is a fixed equal width, a cell whose content doesn't fit is truncated with an ellipsis rather than wrapped — wrapping one cell would push its row out of alignment with every other column.",
      "One more shared detail worth knowing: the underlying PDF font (Helvetica) can only encode a specific character set. Curly quotes and em-dashes are automatically converted to straight quotes and double hyphens, bullet characters become plain hyphens, and any other character the font genuinely can't represent is rendered as a question mark. If your source file relies heavily on special typographic characters, this is the one place output can differ from the original.",
      "For this tool, all three conversions happen entirely in your browser — your file is never uploaded to a server.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-json-xml-and-csv-formatting-validation-and-minifying-work",
    slug: "how-json-xml-and-csv-formatting-validation-and-minifying-work",
    path: "/guides/how-json-xml-and-csv-formatting-validation-and-minifying-work",
    title: "How JSON, XML & CSV Formatting Works",
    description:
      "Learn how JSON, XML, and CSV formatters, validators, and minifiers parse data, what each operation changes, and common errors to avoid.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [
      { type: "tool", id: "tool-json-formatter" },
      { type: "tool", id: "tool-json-minifier" },
      { type: "tool", id: "tool-json-validator" },
      { type: "tool", id: "tool-xml-formatter" },
      { type: "tool", id: "tool-xml-minifier" },
      { type: "tool", id: "tool-xml-validator" },
      { type: "tool", id: "tool-csv-formatter" },
      { type: "tool", id: "tool-csv-cleaner" },
    ],
    body: [
      "Every formatter, minifier, and validator in this family does the same first step before anything else: it fully parses your input using a real parser — JSON.parse for JSON, the browser's own DOMParser for XML. This matters because it means a formatter or minifier can't silently \"fix\" broken input into something that looks plausible but isn't your actual data; invalid input is rejected immediately, with the same specific error message a dedicated validator would show.",
      "For JSON, both tools first check syntax, then change only whitespace outside strings. Formatting offers 2 spaces, 4 spaces or tabs; minifying removes insignificant whitespace. Numeric spelling, escaped strings, member order and duplicate object members remain unchanged, avoiding the rounding or duplicate-member loss that can occur when converting JSON into JavaScript values and back.",
      "XML works similarly but requires more manual work, since browsers don't expose a built-in \"pretty print\" for XML the way they do for JSON. XML Formatter walks the parsed document tree and reconstructs it with 2-space indentation by hand; XML Minifier walks the same tree and reconstructs it with no inter-tag whitespace. Both start from a successfully parsed document, so — as with JSON — malformed XML is caught before either tool produces any output.",
      "CSV Formatter and CSV Cleaner take a related but distinct approach, since CSV has no single canonical grammar the way JSON and XML do. CSV Formatter re-parses your file and re-writes it with consistent quoting and line endings (RFC 4180 style), which fixes files with mixed line endings or inconsistent quoting. CSV Cleaner goes further: it trims stray whitespace from every cell and drops fully empty rows — the two most common problems in manually-edited or badly-exported spreadsheets — without touching the actual values in any cell.",
      "For this tool, all of this happens entirely in your browser. Your file is never uploaded to a server, whether it's valid or not.",
    ],
  },
];

export function getGuide(path: string): GuideEntity | undefined {
  return GUIDES.find((guide) => guide.path === path);
}
