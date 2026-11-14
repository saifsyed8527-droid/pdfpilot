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
      { type: "guide", id: "guide-lossy-vs-lossless-pdf-compression" },
      { type: "help", id: "help-best-compression-setting-for-email" },
      { type: "help", id: "help-why-is-my-compressed-pdf-blurry" },
      { type: "help", id: "help-why-cant-i-select-text-in-compressed-pdf" },
      { type: "checklist", id: "checklist-pdf-compression" },
      { type: "use-case", id: "use-case-compress-a-resume-for-email" },
      { type: "learning-resource", id: "learning-resource-what-is-a-rasterized-pdf" },
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
      { type: "help", id: "help-why-is-the-merge-button-disabled" },
      { type: "help", id: "help-how-many-pdfs-can-i-merge-at-once" },
      { type: "comparison", id: "comparison-merge-pdf-vs-combine-pdf" },
      { type: "use-case", id: "use-case-combine-bank-statements-into-one-pdf" },
      { type: "use-case", id: "use-case-merge-invoices-into-one-pdf" },
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
      { type: "help", id: "help-why-isnt-my-split-pdf-working" },
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
    description: "Tools and guides for turning PDF pages into JPG images, plus what resolution to expect.",
    contains: [
      { type: "tool", id: "tool-pdf-to-jpg" },
      { type: "guide", id: "guide-how-pdf-to-jpg-conversion-works" },
      { type: "guide", id: "guide-what-resolution-are-pdf-to-jpg-images" },
      { type: "help", id: "help-why-did-i-get-multiple-images-from-one-pdf" },
      { type: "help", id: "help-can-i-choose-the-image-quality-for-pdf-to-jpg" },
      { type: "learning-resource", id: "learning-resource-what-is-dpi" },
      { type: "learning-resource", id: "learning-resource-vector-vs-raster-images" },
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
    description: "Tools and guides for turning JPG or PNG images into a single PDF document.",
    contains: [
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "guide", id: "guide-how-jpg-to-pdf-conversion-works" },
      { type: "guide", id: "guide-does-jpg-to-pdf-resize-my-images" },
      { type: "help", id: "help-can-i-reorder-my-images-before-converting-to-pdf" },
      { type: "help", id: "help-why-are-my-pdf-pages-different-sizes-after-converting-from-jpg" },
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
      { type: "tool", id: "tool-edit-pdf" },
      { type: "tool", id: "tool-watermark-pdf" },
      { type: "tool", id: "tool-crop-pdf" },
      { type: "tool", id: "tool-fill-pdf" },
      { type: "tool", id: "tool-pdf-metadata-editor" },
      { type: "tool", id: "tool-flatten-pdf" },
      { type: "tool", id: "tool-insert-pages" },
      { type: "tool", id: "tool-compare-pdf" },
      { type: "tool", id: "tool-add-page-numbers" },
      { type: "learning-resource", id: "learning-resource-what-is-pdf-metadata" },
    ],
  },
  {
    type: "category",
    id: "category-document-conversion-tools",
    slug: "document-conversion-tools",
    path: "/categories/document-conversion-tools",
    title: "Document Conversion Tools",
    description: "Convert between PDF and Word or PowerPoint documents, in either direction.",
    contains: [
      { type: "tool", id: "tool-word-to-pdf" },
      { type: "tool", id: "tool-pdf-to-word" },
      { type: "tool", id: "tool-pdf-to-powerpoint" },
      { type: "tool", id: "tool-pdf-to-excel" },
      { type: "tool", id: "tool-pdf-to-pdfa" },
      { type: "tool", id: "tool-powerpoint-to-pdf" },
      { type: "tool", id: "tool-excel-to-pdf" },
      { type: "tool", id: "tool-html-to-pdf" },
      { type: "comparison", id: "comparison-pdf-to-word-vs-word-to-pdf" },
    ],
  },
  {
    type: "category",
    id: "category-data-conversion-tools",
    slug: "data-conversion-tools",
    path: "/categories/data-conversion-tools",
    title: "Data Conversion Tools",
    description: "Convert between CSV, Excel, and XML for moving structured data between systems.",
    contains: [
      { type: "tool", id: "tool-csv-to-xml" },
      { type: "tool", id: "tool-xml-to-csv" },
      { type: "tool", id: "tool-excel-to-xml" },
      { type: "tool", id: "tool-xml-to-excel" },
      { type: "guide", id: "guide-how-csv-excel-xml-conversion-works" },
      { type: "comparison", id: "comparison-csv-to-xml-vs-excel-to-xml" },
    ],
  },
];

export function getCategory(path: string): CategoryEntity | undefined {
  return CATEGORIES.find((category) => category.path === path);
}
