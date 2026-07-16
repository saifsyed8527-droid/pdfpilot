import type { BaseContentEntity } from "./types";

export interface GlossaryEntity extends BaseContentEntity {
  type: "learning-resource";
  /** The one-sentence, unambiguous definition — shown as the lede on the
   *  page and used as the DefinedTerm schema's description. */
  definition: string;
}

/**
 * Activates the "learning-resource" ContentType, reserved since an earlier
 * phase but never populated (verified: zero entries, zero routes, zero
 * nav/sitemap references existed before this sprint). Each definition
 * below is an established, well-documented technical fact — not
 * PDFPilot-specific marketing claims — the same accuracy bar as every
 * engine doc comment in this project.
 */
export const GLOSSARY: readonly GlossaryEntity[] = [
  {
    type: "learning-resource",
    id: "learning-resource-what-is-ocr",
    slug: "what-is-ocr",
    path: "/glossary/what-is-ocr",
    title: "What Is OCR (Optical Character Recognition)?",
    definition:
      "OCR is the process of analyzing an image of text — a scan or a photo — and converting it into actual, searchable, editable text characters.",
    description:
      "OCR turns a picture of text into real text. Here's what that means in practice and where it's used in document workflows.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [
      { type: "tool", id: "tool-ocr-pdf" },
      { type: "tool", id: "tool-ocr-image" },
    ],
  },
  {
    type: "learning-resource",
    id: "learning-resource-what-is-pdf-metadata",
    slug: "what-is-pdf-metadata",
    path: "/glossary/what-is-pdf-metadata",
    title: "What Is PDF Metadata?",
    definition:
      "PDF metadata is descriptive information stored inside a PDF file but not shown on any page — title, author, subject, keywords, creation date, and the software that produced it.",
    description:
      "Every PDF carries hidden information beyond its visible pages. Here's what metadata actually contains and why it sometimes matters to review before sharing a file.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [{ type: "tool", id: "tool-pdf-metadata-editor" }],
  },
  {
    type: "learning-resource",
    id: "learning-resource-what-is-flattening-a-pdf",
    slug: "what-is-flattening-a-pdf",
    path: "/glossary/what-is-flattening-a-pdf",
    title: "What Does It Mean to \"Flatten\" a PDF?",
    definition:
      "Flattening a PDF converts interactive elements — fillable form fields, in particular — into permanent, non-editable page content.",
    description:
      "\"Flatten\" is common PDF terminology that isn't obvious from the word alone. Here's exactly what it changes in a file.",
    searchIntent: "informational",
    difficulty: "intermediate",
    related: [{ type: "tool", id: "tool-flatten-pdf" }, { type: "tool", id: "tool-fill-pdf" }],
  },
  {
    type: "learning-resource",
    id: "learning-resource-what-is-dpi",
    slug: "what-is-dpi",
    path: "/glossary/what-is-dpi",
    title: "What Is DPI (Dots Per Inch)?",
    definition:
      "DPI measures image resolution — how many pixels are packed into each inch of the image when printed or rendered — with higher DPI meaning more detail and a larger file size.",
    description:
      "DPI comes up constantly when converting between PDFs and images. Here's what the number actually controls.",
    searchIntent: "informational",
    difficulty: "intermediate",
    related: [{ type: "tool", id: "tool-pdf-to-jpg" }, { type: "tool", id: "tool-jpg-to-pdf" }],
  },
  {
    type: "learning-resource",
    id: "learning-resource-what-is-a-rasterized-pdf",
    slug: "what-is-a-rasterized-pdf",
    path: "/glossary/what-is-a-rasterized-pdf",
    title: "What Does \"Rasterized\" Mean for a PDF?",
    definition:
      "A rasterized PDF page has been converted from scalable vector/text content into a fixed grid of pixels — the same transformation a screenshot applies to whatever it captures.",
    description:
      "\"Rasterize\" describes a specific, one-way conversion that comes up in PDF-to-image tools. Here's what changes, and what's lost, when it happens.",
    searchIntent: "informational",
    difficulty: "advanced",
    related: [{ type: "tool", id: "tool-pdf-to-jpg" }],
  },
  {
    type: "learning-resource",
    id: "learning-resource-what-is-xml",
    slug: "what-is-xml",
    path: "/glossary/what-is-xml",
    title: "What Is XML?",
    definition:
      "XML (Extensible Markup Language) is a text format for structured data, built from nested elements written as tags — <element>value</element> — that a human or program can both read.",
    description:
      "XML shows up constantly in data exchange between systems — accounting software, APIs, configuration files. Here's what it actually is and how it's structured.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [
      { type: "tool", id: "tool-csv-to-xml" },
      { type: "tool", id: "tool-excel-to-xml" },
      { type: "tool", id: "tool-xml-to-csv" },
      { type: "tool", id: "tool-xml-to-excel" },
    ],
  },
  {
    type: "learning-resource",
    id: "learning-resource-what-is-heic",
    slug: "what-is-heic",
    path: "/glossary/what-is-heic",
    title: "What Is HEIC?",
    definition:
      "HEIC (High Efficiency Image Container) is the default photo format on iPhones running iOS 11 and later — it stores photos more efficiently than JPG, but isn't natively supported by many browsers, websites, and non-Apple devices.",
    description:
      "HEIC is why an iPhone photo sometimes won't open or upload where a JPG would. Here's what the format actually is and why compatibility is limited.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [
      { type: "tool", id: "tool-heic-to-jpg" },
      { type: "tool", id: "tool-heic-to-png" },
    ],
  },
  {
    type: "learning-resource",
    id: "learning-resource-vector-vs-raster-images",
    slug: "vector-vs-raster-images",
    path: "/glossary/vector-vs-raster-images",
    title: "Vector vs. Raster Images: What's the Difference?",
    definition:
      "A raster image is a fixed grid of pixels, like a JPG or PNG; a vector image, like an SVG, is defined by mathematical shapes and paths that stay perfectly sharp at any size.",
    description:
      "SVG, JPG, and PNG aren't interchangeable the way their file extensions might suggest. Here's the real, structural difference behind vector and raster images.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [
      { type: "tool", id: "tool-svg-to-pdf" },
      { type: "tool", id: "tool-convert-image" },
    ],
  },
  {
    type: "learning-resource",
    id: "learning-resource-what-is-json",
    slug: "what-is-json",
    path: "/glossary/what-is-json",
    title: "What Is JSON?",
    definition:
      "JSON (JavaScript Object Notation) is a text format for structured data built from objects (key-value pairs in curly braces) and arrays (ordered lists in square brackets), read and written natively by virtually every programming language.",
    description:
      "JSON is the most common format APIs and modern software use to exchange data. Here's what it actually is and how it's structured.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [
      { type: "tool", id: "tool-json-to-csv" },
      { type: "tool", id: "tool-csv-to-json" },
      { type: "tool", id: "tool-json-formatter" },
    ],
  },
  {
    type: "learning-resource",
    id: "learning-resource-what-is-yaml",
    slug: "what-is-yaml",
    path: "/glossary/what-is-yaml",
    title: "What Is YAML?",
    definition:
      "YAML (\"YAML Ain't Markup Language\") is a human-readable text format for structured data that uses indentation instead of braces and brackets — commonly used for configuration files like Docker Compose and GitHub Actions.",
    description:
      "YAML shows up constantly in config files for developer tools. Here's what it is and how it relates to JSON, which it can represent exactly.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [
      { type: "tool", id: "tool-yaml-to-json" },
      { type: "tool", id: "tool-json-to-yaml" },
    ],
  },
  {
    type: "learning-resource",
    id: "learning-resource-what-is-base64-encoding",
    slug: "what-is-base64-encoding",
    path: "/glossary/what-is-base64-encoding",
    title: "What Is Base64 Encoding?",
    definition:
      "Base64 is a way of representing arbitrary binary data (like an image or file) as plain text, using only 64 printable characters — needed because some systems (like JSON or email) can only safely carry text, not raw binary bytes.",
    description:
      "Base64 text shows up in data URIs, email attachments, and API payloads. Here's what it actually does, and why it makes files larger, not smaller.",
    searchIntent: "informational",
    difficulty: "beginner",
    related: [
      { type: "tool", id: "tool-base64-encode" },
      { type: "tool", id: "tool-base64-decode" },
    ],
  },
];

export function getGlossaryEntry(path: string): GlossaryEntity | undefined {
  return GLOSSARY.find((entry) => entry.path === path);
}
