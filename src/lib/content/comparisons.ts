import type { BaseContentEntity, EntityRef } from "./types";

export interface ComparisonEntity extends BaseContentEntity {
  type: "comparison";
  /** The things being compared, referenced by id like every other
   *  relationship — resolved via the registry, not hardcoded name/url
   *  pairs (Sprint 6.1; previously duplicated Tool's own `name`). */
  items: EntityRef[];
  points: { label: string; a: string; b: string }[];
}

/**
 * This is an intra-product comparison (two real PDFPilot tools), not a
 * named-competitor comparison. Comparing against a specific competitor
 * would require verified, sourced facts about their current pricing and
 * features — data this project doesn't have access to. Fabricating that
 * would violate the "no invented data" standard enforced throughout this
 * project's SEO work. Every point below is directly verifiable against
 * compress-pdf-client.tsx and split-pdf-client.tsx.
 */
export const COMPARISONS: readonly ComparisonEntity[] = [
  {
    type: "comparison",
    id: "comparison-compress-pdf-vs-split-pdf",
    slug: "compress-pdf-vs-split-pdf",
    path: "/compare/compress-pdf-vs-split-pdf",
    title: "Compress PDF vs. Split PDF: Which One Do You Need?",
    description:
      "Not sure whether to compress or split your PDF? Here's the real difference between the two tools and when to use each.",
    items: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "tool", id: "tool-split-pdf" },
    ],
    points: [
      {
        label: "What it does",
        a: "Reduces the file size of your PDF",
        b: "Extracts specific pages into their own file(s)",
      },
      {
        label: "Best for",
        a: "A large file you need to email or upload somewhere with a size limit",
        b: "Pulling a few pages out of a longer document",
      },
      {
        label: "Output",
        a: "One smaller PDF with the same pages",
        b: "One or more new PDFs, one per page range you choose",
      },
      {
        label: "Use both together when",
        a: "You've split out the pages you need and the result is still too large to send",
        b: "You only need part of a large document and want that part smaller too",
      },
    ],
    related: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "tool", id: "tool-split-pdf" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-merge-pdf-vs-combine-pdf",
    slug: "merge-pdf-vs-combine-pdf",
    path: "/compare/merge-pdf-vs-combine-pdf",
    title: "Merge PDF vs. Combine PDF: What's the Difference?",
    description:
      "Searching for \"combine PDF\"? Here's how that relates to Merge PDF, and how to tell it apart from combining images into a PDF.",
    items: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "tool", id: "tool-jpg-to-pdf" },
    ],
    points: [
      {
        label: "What it does",
        a: "Combines multiple existing PDF files into a single PDF, preserving every page exactly as it was",
        b: "Combines multiple JPG or PNG images into a single PDF, one image per page",
      },
      {
        label: "What you upload",
        a: "Two or more PDF files",
        b: "Two or more image files (JPG or PNG)",
      },
      {
        label: "Also known as",
        a: "\"Combine PDF\" and \"Merge PDF\" both describe this same action",
        b: "Sometimes called \"combine images into PDF\" or \"photos to PDF\"",
      },
      {
        label: "Use this tool when",
        a: "You already have separate PDF documents you want combined into one",
        b: "You have photos or scanned image files you want turned into a PDF",
      },
    ],
    related: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "guide", id: "guide-how-pdf-merging-works" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-split-pdf-vs-merge-pdf",
    slug: "split-pdf-vs-merge-pdf",
    path: "/compare/split-pdf-vs-merge-pdf",
    title: "Split PDF vs. Merge PDF: Which One Do You Need?",
    description:
      "These two tools do opposite things. Here's how to tell which one actually solves your problem.",
    items: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "tool", id: "tool-merge-pdf" },
    ],
    points: [
      {
        label: "What it does",
        a: "Breaks one PDF into one or more smaller PDF files",
        b: "Combines multiple PDF files into a single one",
      },
      {
        label: "Best for",
        a: "Pulling specific pages out of a larger document",
        b: "Combining separate documents into one file",
      },
      {
        label: "Output",
        a: "One or more new PDFs, depending on the page ranges you choose",
        b: "One combined PDF containing every page from your source files, in the order you arrange them",
      },
      {
        label: "Use both together when",
        a: "You need just part of a large document, then want to combine that part with something else",
        b: "You've combined files but need to pull specific pages back out afterward",
      },
    ],
    related: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "tool", id: "tool-merge-pdf" },
      { type: "guide", id: "guide-how-pdf-splitting-works" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-pdf-to-jpg-vs-jpg-to-pdf",
    slug: "pdf-to-jpg-vs-jpg-to-pdf",
    path: "/compare/pdf-to-jpg-vs-jpg-to-pdf",
    title: "PDF to JPG vs. JPG to PDF: Which Direction Do You Need?",
    description:
      "These two tools convert in opposite directions. Here's how to tell which one you actually need.",
    items: [
      { type: "tool", id: "tool-pdf-to-jpg" },
      { type: "tool", id: "tool-jpg-to-pdf" },
    ],
    points: [
      {
        label: "What it does",
        a: "Converts each page of a PDF into its own JPG image",
        b: "Combines JPG or PNG images into a single PDF",
      },
      {
        label: "What you upload",
        a: "One PDF file",
        b: "One or more image files",
      },
      {
        label: "What you get back",
        a: "One JPG image per PDF page",
        b: "One PDF file containing every image as its own page",
      },
      {
        label: "Use this tool when",
        a: "You need to share or use PDF pages as images, for example on a website or in a slideshow",
        b: "You need to combine photos or scanned images into a single document",
      },
    ],
    related: [
      { type: "tool", id: "tool-pdf-to-jpg" },
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "guide", id: "guide-how-pdf-to-jpg-conversion-works" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-jpg-to-pdf-vs-merge-pdf",
    slug: "jpg-to-pdf-vs-merge-pdf",
    path: "/compare/jpg-to-pdf-vs-merge-pdf",
    title: "JPG to PDF vs. Merge PDF: Which One Do You Need?",
    description:
      "Both combine multiple files into one PDF — but they expect different kinds of files. Here's how to tell which one fits.",
    items: [
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "tool", id: "tool-merge-pdf" },
    ],
    points: [
      {
        label: "What it does",
        a: "Combines multiple JPG or PNG images into a single PDF, one image per page",
        b: "Combines multiple existing PDF files into a single PDF",
      },
      {
        label: "What you upload",
        a: "Two or more image files (JPG or PNG)",
        b: "Two or more PDF files",
      },
      {
        label: "Best for",
        a: "Turning photos or scanned pages into a shareable PDF",
        b: "Combining documents you already have as separate PDFs",
      },
      {
        label: "Output page size",
        a: "Each page matches the pixel dimensions of its source image",
        b: "Each page keeps its original size from the source PDF",
      },
    ],
    related: [
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "tool", id: "tool-merge-pdf" },
      { type: "guide", id: "guide-how-jpg-to-pdf-conversion-works" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-ocr-pdf-vs-ocr-image",
    slug: "ocr-pdf-vs-ocr-image",
    path: "/compare/ocr-pdf-vs-ocr-image",
    title: "OCR PDF vs. OCR Image: Which One Do You Need?",
    searchIntent: "commercial",
    difficulty: "beginner",
    description:
      "Both tools run the same OCR engine — the difference is what file type you start with. Here's how to tell which one you need.",
    items: [
      { type: "tool", id: "tool-ocr-pdf" },
      { type: "tool", id: "tool-ocr-image" },
    ],
    points: [
      {
        label: "What you upload",
        a: "A PDF file (scanned or containing embedded images of text)",
        b: "An image file (JPG, PNG, etc.)",
      },
      {
        label: "What it does",
        a: "Renders each PDF page to an image, then runs OCR on every page",
        b: "Runs OCR directly on the single image you upload",
      },
      {
        label: "Best for",
        a: "A scanned multi-page document you already have as a PDF",
        b: "A single photo — for example, a photographed page of handwritten or printed notes",
      },
    ],
    related: [
      { type: "tool", id: "tool-ocr-pdf" },
      { type: "tool", id: "tool-ocr-image" },
      { type: "learning-resource", id: "learning-resource-what-is-ocr" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-pdf-to-word-vs-word-to-pdf",
    slug: "pdf-to-word-vs-word-to-pdf",
    path: "/compare/pdf-to-word-vs-word-to-pdf",
    title: "PDF to Word vs. Word to PDF: Which Direction Do You Need?",
    searchIntent: "commercial",
    difficulty: "beginner",
    description:
      "These two tools convert in opposite directions and are easy to mix up by name alone. Here's the difference.",
    items: [
      { type: "tool", id: "tool-pdf-to-word" },
      { type: "tool", id: "tool-word-to-pdf" },
    ],
    points: [
      {
        label: "What you upload",
        a: "A PDF file",
        b: "A DOCX (Word) file",
      },
      {
        label: "What you get back",
        a: "An editable DOCX file",
        b: "A fixed-layout PDF file",
      },
      {
        label: "Best for",
        a: "Editing the text of a PDF you received — for example, reusing its content in a new document",
        b: "Sending a Word document to someone in a format that won't shift or reflow when they open it",
      },
    ],
    related: [
      { type: "tool", id: "tool-pdf-to-word" },
      { type: "tool", id: "tool-word-to-pdf" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-csv-to-xml-vs-excel-to-xml",
    slug: "csv-to-xml-vs-excel-to-xml",
    path: "/compare/csv-to-xml-vs-excel-to-xml",
    title: "CSV to XML vs. Excel to XML: Which One Do You Need?",
    searchIntent: "commercial",
    difficulty: "beginner",
    description:
      "Both tools produce the same XML structure — the difference is entirely about what file you're starting from. Here's how to tell which one you need.",
    items: [
      { type: "tool", id: "tool-csv-to-xml" },
      { type: "tool", id: "tool-excel-to-xml" },
    ],
    points: [
      {
        label: "What you upload",
        a: "A .csv file",
        b: "An .xlsx (Excel) file",
      },
      {
        label: "What it does",
        a: "Parses the CSV directly — every row becomes an XML <row> element",
        b: "Reads the first sheet with data out of the workbook, then converts those rows the same way",
      },
      {
        label: "Multi-sheet workbooks",
        a: "Not applicable — CSV has no concept of sheets",
        b: "Only the first sheet with data is converted; other sheets are left out",
      },
      {
        label: "Best for",
        a: "Data already exported as CSV, from a database or another system",
        b: "Data still living in an Excel workbook you haven't exported to CSV",
      },
    ],
    related: [
      { type: "tool", id: "tool-csv-to-xml" },
      { type: "tool", id: "tool-excel-to-xml" },
      { type: "learning-resource", id: "learning-resource-what-is-xml" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-heic-to-jpg-vs-heic-to-png",
    slug: "heic-to-jpg-vs-heic-to-png",
    path: "/compare/heic-to-jpg-vs-heic-to-png",
    title: "HEIC to JPG vs. HEIC to PNG: Which Should You Choose?",
    searchIntent: "commercial",
    difficulty: "beginner",
    description:
      "Both tools decode the same iPhone HEIC photo with the same real decoder — the only real difference is the output format's trade-offs. Here's how to pick.",
    items: [
      { type: "tool", id: "tool-heic-to-jpg" },
      { type: "tool", id: "tool-heic-to-png" },
    ],
    points: [
      {
        label: "Compression",
        a: "Lossy — smaller file, small quality trade-off",
        b: "Lossless — larger file, no quality loss from the decoded image",
      },
      {
        label: "Transparency support",
        a: "No",
        b: "Yes (though a HEIC photo itself has no transparency to preserve)",
      },
      {
        label: "Universal compatibility",
        a: "The most widely supported image format there is",
        b: "Also universally supported, just a larger file for the same photo",
      },
      {
        label: "Best for",
        a: "Sharing, uploading, or emailing a photo — the practical default",
        b: "Archiving at maximum fidelity, or when a workflow specifically requires PNG",
      },
    ],
    related: [
      { type: "tool", id: "tool-heic-to-jpg" },
      { type: "tool", id: "tool-heic-to-png" },
      { type: "guide", id: "guide-how-heic-photo-conversion-works" },
      { type: "learning-resource", id: "learning-resource-what-is-heic" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-json-vs-csv",
    slug: "json-vs-csv",
    path: "/compare/json-vs-csv",
    title: "JSON vs. CSV: Which Format Should You Use?",
    searchIntent: "informational",
    difficulty: "beginner",
    description:
      "Both represent the same tabular data, but the two formats aren't interchangeable — here's how to tell which one fits your situation.",
    items: [
      { type: "tool", id: "tool-json-to-csv" },
      { type: "tool", id: "tool-csv-to-json" },
    ],
    points: [
      {
        label: "Structure",
        a: "Nested objects and arrays, any depth",
        b: "Flat rows and columns only",
      },
      {
        label: "Human readability for large tables",
        a: "Verbose — every row repeats every key name",
        b: "Compact — column names appear once, in the header",
      },
      {
        label: "Opens directly in a spreadsheet app",
        a: "No — needs conversion first",
        b: "Yes",
      },
      {
        label: "Best for",
        a: "API responses, config files, nested/hierarchical data",
        b: "Spreadsheet data, bulk import/export, anything already tabular",
      },
    ],
    related: [
      { type: "tool", id: "tool-json-to-csv" },
      { type: "tool", id: "tool-csv-to-json" },
      { type: "guide", id: "guide-how-pdfpilots-data-format-tools-fit-together" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-csv-cleaner-vs-duplicate-row-remover",
    slug: "csv-cleaner-vs-duplicate-row-remover",
    path: "/compare/csv-cleaner-vs-duplicate-row-remover",
    title: "CSV Cleaner vs. Duplicate Row Remover: What's the Difference?",
    searchIntent: "commercial",
    difficulty: "beginner",
    description:
      "Both tidy up a messy CSV, but they fix different problems — here's exactly what each one changes.",
    items: [
      { type: "tool", id: "tool-csv-cleaner" },
      { type: "tool", id: "tool-duplicate-row-remover" },
    ],
    points: [
      {
        label: "What it fixes",
        a: "Stray whitespace in cells, and fully empty rows",
        b: "Rows that exactly duplicate an earlier row",
      },
      {
        label: "Changes cell values?",
        a: "Yes — trims leading/trailing whitespace",
        b: "No — rows are kept or removed as-is, never edited",
      },
      {
        label: "Comparison method",
        a: "Not applicable",
        b: "Exact match, case- and whitespace-sensitive",
      },
      {
        label: "Use both together when",
        a: "Your export has both messy whitespace and repeated rows",
        b: "Your export has both messy whitespace and repeated rows",
      },
    ],
    related: [
      { type: "tool", id: "tool-csv-cleaner" },
      { type: "tool", id: "tool-duplicate-row-remover" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-base64-encode-vs-base64-decode",
    slug: "base64-encode-vs-base64-decode",
    path: "/compare/base64-encode-vs-base64-decode",
    title: "Base64 Encode vs. Base64 Decode: Which One Do You Need?",
    searchIntent: "commercial",
    difficulty: "beginner",
    description:
      "These two tools are exact inverses of each other. Here's how to tell which direction you actually need.",
    items: [
      { type: "tool", id: "tool-base64-encode" },
      { type: "tool", id: "tool-base64-decode" },
    ],
    points: [
      {
        label: "What it does",
        a: "Converts a file's raw bytes into Base64 text",
        b: "Converts Base64 text back into the original file's bytes",
      },
      {
        label: "Input",
        a: "Any file — image, PDF, document, or otherwise",
        b: "A block of Base64-encoded text",
      },
      {
        label: "Output",
        a: "A block of Base64 text you can copy or download",
        b: "The original file, restored from its Base64 text",
      },
      {
        label: "Typical use",
        a: "Embedding a file's data directly inside JSON, CSS, or an HTML data: URI",
        b: "Recovering a file from Base64 text pasted into an email, API response, or config file",
      },
    ],
    related: [
      { type: "tool", id: "tool-base64-encode" },
      { type: "tool", id: "tool-base64-decode" },
      { type: "learning-resource", id: "learning-resource-what-is-base64-encoding" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-markdown-to-html-vs-html-to-markdown",
    slug: "markdown-to-html-vs-html-to-markdown",
    path: "/compare/markdown-to-html-vs-html-to-markdown",
    title: "Markdown to HTML vs. HTML to Markdown: Which One Do You Need?",
    searchIntent: "commercial",
    difficulty: "beginner",
    description:
      "Two real, independent converters running in opposite directions — not the same logic reversed. Here's when each one is the right tool.",
    items: [
      { type: "tool", id: "tool-markdown-to-html" },
      { type: "tool", id: "tool-html-to-markdown" },
    ],
    points: [
      {
        label: "What it does",
        a: "Converts Markdown syntax — headings, lists, links, tables, code blocks — into real HTML markup",
        b: "Converts HTML markup back into readable Markdown syntax",
      },
      {
        label: "Engine",
        a: "marked, a standard Markdown parser, producing complete HTML output",
        b: "turndown, a standard HTML-to-Markdown converter, run in the opposite direction",
      },
      {
        label: "Best for",
        a: "Publishing Markdown content — READMEs, notes, docs — as a web page or HTML email",
        b: "Turning a web page or HTML document into clean, editable Markdown for a wiki, README, or static site",
      },
      {
        label: "Round-tripping",
        a: "Converting to HTML and back to Markdown may not reproduce the exact original source, since HTML can express things Markdown can't cleanly represent",
        b: "The same caveat applies in reverse — complex or non-standard HTML may simplify when converted to Markdown",
      },
    ],
    related: [
      { type: "tool", id: "tool-markdown-to-html" },
      { type: "tool", id: "tool-html-to-markdown" },
    ],
  },
  {
    type: "comparison",
    id: "comparison-json-formatter-vs-json-minifier",
    slug: "json-formatter-vs-json-minifier",
    path: "/compare/json-formatter-vs-json-minifier",
    title: "JSON Formatter vs. JSON Minifier: Which One Do You Need?",
    searchIntent: "commercial",
    difficulty: "beginner",
    description:
      "Both tools re-serialize the same valid JSON — the only real difference is whether whitespace goes in or comes out. Here's how to pick.",
    items: [
      { type: "tool", id: "tool-json-formatter" },
      { type: "tool", id: "tool-json-minifier" },
    ],
    points: [
      {
        label: "What it does",
        a: "Re-serializes JSON with 2-space indentation for readability",
        b: "Strips all non-essential whitespace to produce the smallest possible JSON text",
      },
      {
        label: "Validates input first",
        a: "Yes — invalid JSON is rejected with a clear parser error before formatting",
        b: "Yes — the same validation runs before minifying",
      },
      {
        label: "Best for",
        a: "Reading, reviewing, or debugging a JSON file or API response",
        b: "Reducing payload size before sending, storing, or embedding JSON inline in code",
      },
      {
        label: "Output size",
        a: "Larger than the original if it wasn't already indented",
        b: "Smaller than or equal to the original — never larger",
      },
    ],
    related: [
      { type: "tool", id: "tool-json-formatter" },
      { type: "tool", id: "tool-json-minifier" },
      { type: "tool", id: "tool-json-validator" },
    ],
  },
];

export function getComparison(path: string): ComparisonEntity | undefined {
  return COMPARISONS.find((comparison) => comparison.path === path);
}
