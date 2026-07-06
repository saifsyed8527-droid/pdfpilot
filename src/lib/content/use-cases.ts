import type { BaseContentEntity, EntityRef } from "./types";

export interface UseCaseEntity extends BaseContentEntity {
  type: "use-case";
  steps: { tool: EntityRef; instruction: string }[];
}

export const USE_CASES: readonly UseCaseEntity[] = [
  {
    type: "use-case",
    id: "use-case-extract-and-shrink-pages-from-a-large-pdf",
    slug: "extract-and-shrink-pages-from-a-large-pdf",
    path: "/use-cases/extract-and-shrink-pages-from-a-large-pdf",
    title: "Extract and Shrink Pages From a Large PDF",
    description:
      "Only need a few pages from a large PDF, and need to keep the result small enough to email? Here's the two-step way to do it.",
    steps: [
      {
        tool: { type: "tool", id: "tool-split-pdf" },
        instruction: "Use Split PDF to pull out just the page range you need from the original document.",
      },
      {
        tool: { type: "tool", id: "tool-compress-pdf" },
        instruction: "If the extracted pages are still too large to send, run the result through Compress PDF to shrink the file size further.",
      },
    ],
    related: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "tool", id: "tool-compress-pdf" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-combine-bank-statements-into-one-pdf",
    slug: "combine-bank-statements-into-one-pdf",
    path: "/use-cases/combine-bank-statements-into-one-pdf",
    title: "Combine Bank Statements Into One PDF",
    description:
      "Have separate monthly bank statement PDFs you need as a single document? Here's how to combine them in the right order.",
    steps: [
      {
        tool: { type: "tool", id: "tool-merge-pdf" },
        instruction:
          "Upload each monthly statement PDF, then drag them into chronological order — the merged file will follow the exact order you arrange them in.",
      },
      {
        tool: { type: "tool", id: "tool-merge-pdf" },
        instruction:
          "Merge the files into a single PDF and download it. Every page from each statement is preserved exactly as it was, so all your original numbers and formatting stay intact.",
      },
    ],
    related: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "guide", id: "guide-how-pdf-merging-works" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-split-a-scanned-pdf-into-separate-documents",
    slug: "split-a-scanned-pdf-into-separate-documents",
    path: "/use-cases/split-a-scanned-pdf-into-separate-documents",
    title: "Split a Scanned PDF Into Separate Documents",
    description:
      "Scanned multiple documents into one PDF by mistake? Here's how to split it back into individual files.",
    steps: [
      {
        tool: { type: "tool", id: "tool-split-pdf" },
        instruction:
          "Upload the scanned PDF and note which page ranges belong to which document — the page count and a preview of your file appear right after upload.",
      },
      {
        tool: { type: "tool", id: "tool-split-pdf" },
        instruction:
          "Enter each document's page range separated by commas (for example, 1-2,3-4,5-6) — Split PDF creates one separate file for each range you enter, ready to download individually or all at once.",
      },
    ],
    related: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "guide", id: "guide-how-pdf-splitting-works" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-create-preview-images-from-a-pdf-for-a-website",
    slug: "create-preview-images-from-a-pdf-for-a-website",
    path: "/use-cases/create-preview-images-from-a-pdf-for-a-website",
    title: "Create Preview Images From a PDF for a Website or Presentation",
    description:
      "Need an image version of a PDF page to embed in a website, slide deck, or document? Here's how.",
    steps: [
      {
        tool: { type: "tool", id: "tool-pdf-to-jpg" },
        instruction:
          "Upload the PDF. PDF to JPG converts every page into its own JPG image — there's no option to convert only specific pages, so the whole document is processed.",
      },
      {
        tool: { type: "tool", id: "tool-pdf-to-jpg" },
        instruction:
          "Download the image for the specific page you need, or use \"Download All\" if you need more than one.",
      },
    ],
    related: [
      { type: "tool", id: "tool-pdf-to-jpg" },
      { type: "guide", id: "guide-how-pdf-to-jpg-conversion-works" },
    ],
  },
  {
    type: "use-case",
    id: "use-case-combine-scanned-photos-into-a-single-pdf",
    slug: "combine-scanned-photos-into-a-single-pdf",
    path: "/use-cases/combine-scanned-photos-into-a-single-pdf",
    title: "Combine Scanned Photos Into a Single PDF",
    description:
      "Took photos of a multi-page paper document with your phone? Here's how to turn them into one PDF, in the right order.",
    steps: [
      {
        tool: { type: "tool", id: "tool-jpg-to-pdf" },
        instruction:
          "Upload each photo in the order the pages should appear. JPG to PDF doesn't support reordering afterward, so add them in sequence from the start — or upload them in batches and remove any that are out of place before continuing.",
      },
      {
        tool: { type: "tool", id: "tool-jpg-to-pdf" },
        instruction:
          "Convert the images to a single PDF and download it. Each photo becomes its own page, sized to match that photo's original dimensions.",
      },
    ],
    related: [
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "guide", id: "guide-how-jpg-to-pdf-conversion-works" },
      { type: "help", id: "help-can-i-reorder-my-images-before-converting-to-pdf" },
    ],
  },
];

export function getUseCase(path: string): UseCaseEntity | undefined {
  return USE_CASES.find((useCase) => useCase.path === path);
}
