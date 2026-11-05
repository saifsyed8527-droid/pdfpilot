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
      "Understand how PDF compression reduces file size, what you gain, and the one real trade-off to know about before you compress a document.",
    related: [{ type: "tool", id: "tool-compress-pdf" }],
    body: [
      "PDF compression makes a file smaller by re-encoding each page as a lower-resolution image rather than leaving its original text, vector graphics, and fonts untouched. That's why Compress PDF asks you to choose a quality level — Maximum Compression, Medium, or High Quality — each trading visual fidelity for a smaller file.",
      "Behind the scenes, every page is rendered to a canvas at your chosen scale, exported as a JPEG at a matching quality setting, and re-embedded into a new PDF. Photos and scanned pages usually compress well this way, since they were raster images to begin with.",
      "The trade-off worth knowing: because compression rebuilds each page as an image, any text in the original document is no longer selectable, searchable, or copyable in the compressed file. If you need to keep your PDF's text searchable, keep the original alongside the compressed copy, or skip compression for text-heavy documents where file size isn't a concern.",
      "For this tool, compression happens entirely in your browser — your file is never uploaded to a server.",
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
      "Compression algorithms generally fall into two categories: lossless, which shrinks a file without discarding any information, and lossy, which reduces file size by permanently discarding some detail in exchange for a smaller result. The two aren't interchangeable — which one applies depends on what's actually inside the file.",
      "PDFPilot's Compress PDF tool uses lossy compression. Each page is rendered to a canvas and re-encoded as a JPEG image at a quality level tied to the setting you choose — Maximum Compression (scale 0.6, JPEG quality 0.5), Medium (0.8, 0.7), or High Quality (1.0, 0.92). JPEG itself is a lossy image format, so some visual detail is discarded at every setting; higher settings simply discard less.",
      "This is a deliberate trade-off, not a limitation to work around. Scanned documents and photo-heavy pages are usually already raster images, so re-encoding them at a lower quality is an effective way to shrink them significantly. The cost is that the resulting PDF's pages are images — meaning text is no longer selectable, searchable, or copyable, regardless of which quality setting you pick.",
      "A true lossless approach to PDF size reduction exists too — for example, removing unused embedded fonts or recompressing already-lossless image data more efficiently — but that typically saves far less space on documents that are already text- or vector-based, and none of it changes the trade-off for scanned or image-heavy PDFs. If keeping your text selectable matters more than achieving the smallest possible file, compression may not be the right tool for that particular document.",
      "For this tool, this happens entirely in your browser. Your file is never uploaded to a server, at any quality setting.",
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
      "Understand how PDFPilot breaks a PDF into smaller files, and why splitting can produce more than one output file.",
    related: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "guide", id: "guide-how-to-choose-page-ranges-when-splitting-a-pdf" },
      { type: "help", id: "help-why-did-splitting-my-pdf-create-multiple-files" },
    ],
    body: [
      "Splitting works by copying pages from your original PDF into one or more new documents, based on the page ranges you enter. Nothing is re-rendered or re-encoded — copied pages keep their original text, images, and formatting exactly as they were.",
      "Each comma-separated range or page number you enter becomes its own separate output file. Entering \"1-3,5,7-9\" produces three files, not one: pages 1 through 3 in the first file, page 5 in the second, and pages 7 through 9 in the third. You can download each file individually or all at once.",
      "Page numbers outside your document's actual page count are simply skipped rather than causing an error, so it's worth checking the page count shown after upload before entering ranges.",
      "For this tool, splitting happens entirely in your browser — your file is never uploaded to a server.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-to-choose-page-ranges-when-splitting-a-pdf",
    slug: "how-to-choose-page-ranges-when-splitting-a-pdf",
    path: "/guides/how-to-choose-page-ranges-when-splitting-a-pdf",
    title: "How to Choose Page Ranges When Splitting a PDF",
    description:
      "A practical walkthrough of Split PDF's page-range syntax, from single pages to multiple ranges at once.",
    related: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "guide", id: "guide-how-pdf-splitting-works" },
    ],
    body: [
      "Split PDF's page-range field accepts a few simple formats. A single page number, like \"5\", extracts just that page. A range with a hyphen, like \"7-9\", extracts every page from 7 through 9 inclusive. Separating entries with commas lets you combine several of these in one go, like \"1-3,5,7-9\".",
      "Each comma-separated entry becomes its own output file — so \"1-3,5,7-9\" produces three separate PDFs, not one file containing all of those pages together. If you want all of those pages combined into a single file instead, you'd need to merge the resulting files back together afterward using Merge PDF.",
      "By default, the range field is pre-filled with your document's full page span (for example, \"1-12\" for a 12-page file), so you only need to edit it down to the pages you actually want.",
      "Ranges don't need to be entered in page order, and overlapping ranges are allowed — each one is processed independently. Page numbers that fall outside your document's actual page count are skipped rather than causing an error.",
    ],
  },
  {
    type: "guide",
    id: "guide-how-pdf-to-jpg-conversion-works",
    slug: "how-pdf-to-jpg-conversion-works",
    path: "/guides/how-pdf-to-jpg-conversion-works",
    title: "How PDF to JPG Conversion Works",
    description:
      "Understand how PDFPilot turns each page of a PDF into its own JPG image.",
    related: [
      { type: "tool", id: "tool-pdf-to-jpg" },
      { type: "guide", id: "guide-what-resolution-are-pdf-to-jpg-images" },
      { type: "help", id: "help-why-did-i-get-multiple-images-from-one-pdf" },
    ],
    body: [
      "PDF to JPG converts every page of your document into its own image, one at a time. Each page is rendered onto a canvas at twice its original scale, then exported as a JPEG. A 10-page PDF produces 10 separate JPG files.",
      "Unlike Compress PDF, there's no quality picker here — the rendering scale and JPEG quality are both fixed. This is a one-way conversion optimized for producing clean, high-fidelity images rather than the smallest possible file size.",
      "Because every page is processed independently, there's no option to convert only specific pages — uploading a PDF always converts the entire document.",
      "For this tool, conversion happens entirely in your browser. Your file is never uploaded to a server.",
    ],
  },
  {
    type: "guide",
    id: "guide-what-resolution-are-pdf-to-jpg-images",
    slug: "what-resolution-are-pdf-to-jpg-images",
    path: "/guides/what-resolution-are-pdf-to-jpg-images",
    title: "What Resolution Are PDF to JPG Images?",
    description:
      "PDF to JPG uses a fixed rendering scale and JPEG quality. Here's what that actually means for your output images.",
    related: [
      { type: "tool", id: "tool-pdf-to-jpg" },
      { type: "guide", id: "guide-how-pdf-to-jpg-conversion-works" },
    ],
    body: [
      "Each page is rendered at twice (2x) its defined size in the PDF before being exported as a JPEG. Because a PDF page's size is defined in points rather than pixels, the exact pixel dimensions of the resulting image depend on that page's own dimensions — a standard-sized page produces a correspondingly sized image, and a larger page produces a larger image, always at that same 2x multiplier.",
      "The JPEG itself is exported at a fixed quality of 0.9 (out of 1.0), which is high enough that compression artifacts are rarely noticeable. There's no setting to trade quality for a smaller file size, unlike Compress PDF's adjustable quality tiers.",
      "In practice, this combination produces images sharp enough for most uses — viewing, printing, or embedding in a document or webpage — without any configuration required.",
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
      "JPG to PDF accepts JPG, JPEG, and PNG image files. Each image you upload becomes its own page in the resulting PDF, added in the order you uploaded them.",
      "Images are embedded directly into the PDF rather than being re-compressed or re-encoded — a PNG is embedded as a PNG, and a JPG is embedded as a JPG, so the original image data is preserved.",
      "Every page is created at the exact pixel dimensions of its source image, not a standard page size like Letter or A4. If you combine images of different sizes, the resulting PDF's pages will be different sizes too.",
      "For this tool, this happens entirely in your browser. Your images are never uploaded to a server.",
    ],
  },
  {
    type: "guide",
    id: "guide-does-jpg-to-pdf-resize-my-images",
    slug: "does-jpg-to-pdf-resize-my-images",
    path: "/guides/does-jpg-to-pdf-resize-my-images",
    title: "Does JPG to PDF Resize My Images?",
    description:
      "No — each PDF page matches its source image's exact dimensions. Here's what that means if you're combining images of different sizes.",
    related: [
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "guide", id: "guide-how-jpg-to-pdf-conversion-works" },
    ],
    body: [
      "JPG to PDF doesn't resize, crop, or stretch your images to fit a standard page. Each page is created at exactly the pixel dimensions of the image it came from — a 4000×3000 pixel photo produces a page sized to those exact proportions.",
      "This means the resulting PDF's pages won't be a consistent size if you combine images with different dimensions or aspect ratios, since each page is sized independently. A PDF made from a portrait photo and a landscape photo will have one tall page and one wide page, not two uniform ones.",
      "This trade-off keeps your original image quality and framing completely intact — nothing is cropped or distorted to fit a fixed page size. If you need uniform page sizes, it's worth resizing or cropping your images to matching dimensions before converting.",
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
  "HEIC is a common photo format on iPhones. It stores compressed images efficiently, but support varies between browsers and other software. Converting to JPG or PNG can make a photo easier to open and share.",
  "PDFPilot decodes supported HEIC and HEIF files with a libheif-based decoder in your browser, then writes the decoded pixels as JPG or PNG. The decoder may need to download before the first conversion.",
  "JPG uses lossy compression and is usually a practical choice for photos and upload forms. PNG keeps the decoded pixels without another lossy compression step and can be larger. Converting an already compressed photo cannot recover detail lost earlier.",
  "Check orientation, colours, dimensions and the downloaded image before sharing. Choose a file from your device for browser processing. A Google Drive or Dropbox shared-link import uses the server to retrieve the linked file before processing in your browser."
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
  "Image Watermark draws text or a logo into the pixels of an image. The downloaded image contains the mark, rather than a separate editable layer. Keep an unmarked original if you need to make changes later.",
  "You can add up to ten watermark layers. Each layer has its own position, size, rotation and opacity. Text layers also offer font styling, colours and a background; image layers use a logo file.",
  "The preview helps you place a mark where it is legible without hiding important detail. Tiling repeats a mark across the image. A repeated mark can cover more of a proof than a single mark in a corner, but it does not prevent copying.",
  "Opacity controls how much of the underlying image remains visible. Inspect the preview and the final download at a readable size, especially if the original image is much larger than the preview.",
  "Files chosen from your device are processed in the browser. Shared-link imports use the server to retrieve the selected file. Check the import dialog for its size and access requirements."
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
  "Many PDFPilot data converters use a table made of a header row and data rows. CSV and TSV represent the rows with delimiters; Excel stores them in a worksheet; JSON can represent them as an array of records. This common shape makes compatible conversion steps possible.",
  "Table conversions need a usable column structure. An array of JSON objects is a suitable input. Nested objects and missing fields need particular care: a flat table cannot preserve every relationship in an arbitrary JSON document.",
  "SQL import reads supported INSERT statements with explicit column names. It does not execute queries or connect to a database. SQL export writes a script for review; check identifiers, quoting, types and your database dialect before using it.",
  "Check value types after conversion. CSV and TSV do not distinguish a numeric-looking identifier from a number, while JSON, SQL and Excel can carry types. Leading zeros, dates and large identifiers deserve special attention. A file changing format is not a guarantee of a lossless round trip.",
  "Workbook readers use a selected worksheet when the tool offers that setting; otherwise the first sheet is used. Export the required sheet first if needed. A connected workflow shows the accepted input and result format before it runs, and passes the actual output of its first step to the second."
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
  "TXT, Markdown and CSV need different layouts when converted to PDF. Text flows as paragraphs, Markdown describes document structure, and CSV supplies rows and columns. Review the page settings and preview for the tool you choose.",
  "TXT to PDF lays out readable text across pages. Markdown to PDF also interprets supported headings, paragraphs, lists, tables and code blocks. It is a document renderer, so it may not reproduce the appearance of a particular website or Markdown editor.",
  "CSV to PDF turns a table into PDF pages using the first row as a header. Wide tables and long values need room: review page orientation, column fit and line wrapping rather than assuming a large spreadsheet will fit on one page.",
  "After conversion, open the download and check page breaks, symbols, links and table cells. Unsupported input should be corrected rather than accepted as a successful empty output. Preserve the original text or data file for later editing.",
  "Files selected from your device are processed in your browser. Shared-link imports retrieve the linked file through the server first; the import dialog explains the access and size limits."
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
