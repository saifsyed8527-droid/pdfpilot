import type { BaseContentEntity, EntityRef } from "./types";

export interface CategoryEntity extends BaseContentEntity {
  type: "category";
  contains: EntityRef[];
}

/**
 * "optimize" is the real `category` value already assigned to Compress PDF
 * in src/lib/tools-data.json (Sprint 4.1) — this hub isn't a new taxonomy,
 * it's the first page rendering a category that already existed as data.
 */
export const CATEGORIES: readonly CategoryEntity[] = [
  {
    type: "category",
    id: "category-optimize",
    slug: "optimize",
    path: "/categories/optimize",
    title: "Compress & Optimize PDFs",
    description: "Tools and guides for reducing PDF file size without losing what matters.",
    contains: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "guide", id: "guide-how-pdf-compression-works" },
    ],
  },
  {
    type: "category",
    id: "category-merge-pdf-tools",
    slug: "merge-pdf-tools",
    path: "/categories/merge-pdf-tools",
    title: "Merge PDF Tools",
    description: "Tools and guides for combining multiple PDF files into one document.",
    contains: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "guide", id: "guide-how-pdf-merging-works" },
      { type: "guide", id: "guide-merge-multiple-pdfs-without-losing-quality" },
      { type: "help", id: "help-why-are-my-pdfs-not-merging" },
    ],
  },
  {
    type: "category",
    id: "category-split-pdf-tools",
    slug: "split-pdf-tools",
    path: "/categories/split-pdf-tools",
    title: "Split PDF Tools",
    description: "Tools and guides for breaking a PDF into smaller files or extracting specific pages.",
    contains: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "guide", id: "guide-how-pdf-splitting-works" },
      { type: "guide", id: "guide-how-to-choose-page-ranges-when-splitting-a-pdf" },
      { type: "help", id: "help-why-did-splitting-my-pdf-create-multiple-files" },
      { type: "comparison", id: "comparison-split-pdf-vs-merge-pdf" },
      { type: "use-case", id: "use-case-split-a-scanned-pdf-into-separate-documents" },
    ],
  },
  {
    type: "category",
    id: "category-pdf-to-jpg-tools",
    slug: "pdf-to-jpg-tools",
    path: "/categories/pdf-to-jpg-tools",
    title: "PDF to JPG Tools",
    description: "Tools and guides for turning PDF pages into images.",
    contains: [
      { type: "tool", id: "tool-pdf-to-jpg" },
      { type: "guide", id: "guide-how-pdf-to-jpg-conversion-works" },
      { type: "guide", id: "guide-what-resolution-are-pdf-to-jpg-images" },
      { type: "help", id: "help-why-did-i-get-multiple-images-from-one-pdf" },
      { type: "comparison", id: "comparison-pdf-to-jpg-vs-jpg-to-pdf" },
      { type: "use-case", id: "use-case-create-preview-images-from-a-pdf-for-a-website" },
    ],
  },
  {
    type: "category",
    id: "category-jpg-to-pdf-tools",
    slug: "jpg-to-pdf-tools",
    path: "/categories/jpg-to-pdf-tools",
    title: "JPG to PDF Tools",
    description: "Tools and guides for turning images into a PDF document.",
    contains: [
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "guide", id: "guide-how-jpg-to-pdf-conversion-works" },
      { type: "guide", id: "guide-does-jpg-to-pdf-resize-my-images" },
      { type: "help", id: "help-can-i-reorder-my-images-before-converting-to-pdf" },
      { type: "comparison", id: "comparison-jpg-to-pdf-vs-merge-pdf" },
      { type: "use-case", id: "use-case-combine-scanned-photos-into-a-single-pdf" },
    ],
  },
  {
    type: "category",
    id: "category-pdf-editing-tools",
    slug: "pdf-editing-tools",
    path: "/categories/pdf-editing-tools",
    title: "PDF Editing Tools",
    description: "Tools for adding a watermark, cropping pages, and filling in form fields.",
    contains: [
      { type: "tool", id: "tool-watermark-pdf" },
      { type: "tool", id: "tool-crop-pdf" },
      { type: "tool", id: "tool-fill-pdf" },
      { type: "tool", id: "tool-pdf-metadata-editor" },
      { type: "tool", id: "tool-flatten-pdf" },
      { type: "tool", id: "tool-insert-pages" },
      { type: "tool", id: "tool-compare-pdf" },
    ],
  },
  {
    type: "category",
    id: "category-document-conversion-tools",
    slug: "document-conversion-tools",
    path: "/categories/document-conversion-tools",
    title: "Document Conversion Tools",
    description: "Convert between PDF and Word or PowerPoint documents.",
    contains: [
      { type: "tool", id: "tool-word-to-pdf" },
      { type: "tool", id: "tool-pdf-to-word" },
      { type: "tool", id: "tool-pdf-to-powerpoint" },
    ],
  },
];

export function getCategory(path: string): CategoryEntity | undefined {
  return CATEGORIES.find((category) => category.path === path);
}
