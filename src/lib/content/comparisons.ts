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
];

export function getComparison(path: string): ComparisonEntity | undefined {
  return COMPARISONS.find((comparison) => comparison.path === path);
}
