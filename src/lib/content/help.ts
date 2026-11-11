import type { BaseContentEntity } from "./types";

export interface HelpEntity extends BaseContentEntity {
  type: "help";
  /** The symptom, framed as the question a user would actually search. */
  question: string;
  /** Cause + fix combined — this is what makes Help reusable as FAQPage schema. */
  answer: string;
}

/**
 * Seed content grounded in real, verifiable product behavior: the Merge PDFs
 * button is disabled via `files.length < 2` in merge-pdf-client.tsx — nothing
 * here is invented.
 */
export const HELP_ENTRIES: readonly HelpEntity[] = [
  {
    type: "help",
    id: "help-why-is-the-merge-button-disabled",
    slug: "why-is-the-merge-button-disabled",
    path: "/help/why-is-the-merge-button-disabled",
    title: "Why Is the Merge PDFs Button Disabled?",
    description:
      "The Merge PDFs button stays disabled until you've added at least two files. Here's why, and what to do about it.",
    question: "Why is the Merge PDFs button disabled?",
    answer:
      "The Merge PDFs button only becomes active once you've added at least two files. Merging a single file wouldn't combine anything, so PDFPilot keeps the button disabled until there's something to merge. Add a second PDF using the upload area, and the button will become clickable.",
    related: [{ type: "tool", id: "tool-merge-pdf" }],
  },
  {
    type: "help",
    id: "help-why-are-my-pdfs-not-merging",
    slug: "why-are-my-pdfs-not-merging",
    path: "/help/why-are-my-pdfs-not-merging",
    title: "Why Are My PDFs Not Merging?",
    description:
      "If merging fails, it's almost always because of one specific file, not the tool. Here's what to check.",
    question: "Why are my PDFs not merging?",
    answer:
      "Merge PDF works by copying the pages from each of your files directly into a new document, so a merge will fail if one of the source files can't be opened at all — most commonly because it's corrupted or protected with a password. If you see an error, try merging your files one pair at a time to find which one is causing the problem, then re-save or remove the password from that file before trying again. If every file opens normally on its own, try refreshing the page and re-uploading them.",
    related: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "guide", id: "guide-how-pdf-merging-works" },
    ],
  },
  {
    type: "help",
    id: "help-how-many-pdfs-can-i-merge-at-once",
    slug: "how-many-pdfs-can-i-merge-at-once",
    path: "/help/how-many-pdfs-can-i-merge-at-once",
    title: "How Many PDFs Can I Merge at Once?",
    description:
      "There's no fixed file-count limit on Merge PDF — here's what actually determines how many files you can combine.",
    question: "How many PDFs can I merge at once?",
    answer:
      "There's no fixed limit on the number of files you can add to Merge PDF — you can add as many PDFs as you want to combine into one document. The one real constraint is size: each individual file can be up to 100MB, and because merging processes everything in your browser rather than on a server, adding a very large number of sizable files will use more of your device's memory and take longer to process. For most everyday merges — combining a handful of documents — this isn't something you'll notice.",
    related: [
      { type: "tool", id: "tool-merge-pdf" },
      { type: "guide", id: "guide-how-pdf-merging-works" },
    ],
  },
  {
    type: "help",
    id: "help-why-is-my-compressed-pdf-blurry",
    slug: "why-is-my-compressed-pdf-blurry",
    path: "/help/why-is-my-compressed-pdf-blurry",
    title: "Why Is My Compressed PDF Blurry?",
    description:
      "A blurry result after compression usually comes down to the quality setting you chose, not a mistake. Here's why, and how to get a sharper file.",
    question: "Why is my compressed PDF blurry?",
    answer:
      "A smaller compressed PDF is rebuilt from JPEG page images. Extreme Compression uses the lowest resolution and strongest compression, which can blur small text and diagrams. Start again from your original file and choose Recommended Compression or Less Compression. Compare the smallest text at normal reading size and check the final byte size. Recompressing an already blurry copy cannot restore lost detail. If readable output cannot fit the required limit, remove unnecessary pages or split the document when multiple files are accepted.",
    related: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "guide", id: "guide-how-pdf-compression-works" },
    ],
  },
  {
    type: "help",
    id: "help-why-cant-i-select-text-in-compressed-pdf",
    slug: "why-cant-i-select-text-in-compressed-pdf",
    path: "/help/why-cant-i-select-text-in-compressed-pdf",
    title: "Why Can't I Select Text in My Compressed PDF?",
    description:
      "A smaller rasterized PDF has image pages instead of the original text. Learn why text selection changes and when PDFPilot keeps the original file.",
    question: "Why can't I select text in my compressed PDF?",
    answer:
      "When PDFPilot produces a smaller compressed file, it rebuilds the pages as JPEG images. Those pages no longer contain the original selectable text, interactive forms or links. Keep your original if you need those features, or reduce the document by removing unnecessary pages instead. If compression would make the file the same size or larger, PDFPilot returns the original bytes unchanged; in that case its existing text stays intact. OCR can attempt to recognize text from an image, but it does not restore the original document structure.",
    related: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "guide", id: "guide-how-pdf-compression-works" },
    ],
  },
  {
    type: "help",
    id: "help-best-compression-setting-for-email",
    slug: "best-compression-setting-for-email",
    path: "/help/best-compression-setting-for-email",
    title: "What's the Best Compression Setting for Email?",
    description:
      "Most email providers cap attachment size, so picking the right compression setting matters. Here's how to choose.",
    question: "What's the best compression setting for sending a PDF by email?",
    answer:
      "Check the attachment limit used by your recipient and email service, then start with Recommended Compression. Open the result, confirm the text is readable and compare its actual file size with the limit. Try Extreme Compression from the original only if you can accept lower image quality; use Less Compression when small text or diagrams become blurry. There is no guaranteed final KB or MB size. Extract only the pages the recipient needs, or split the PDF if multiple attachments are acceptable. Keep the original because a smaller rasterized output loses selectable text and interactive features.",
    related: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "use-case", id: "use-case-extract-and-shrink-pages-from-a-large-pdf" },
    ],
  },
  {
    type: "help",
    id: "help-why-did-splitting-my-pdf-create-multiple-files",
    slug: "why-did-splitting-my-pdf-create-multiple-files",
    path: "/help/why-did-splitting-my-pdf-create-multiple-files",
    title: "Why Did Splitting My PDF Create Multiple Files?",
    description:
      "Split PDF can save each range or selected page separately. Turn on the merge option when you want the selection in one PDF.",
    question: "Why did splitting my PDF create multiple files?",
    answer:
      "In Range → Custom, each From/To range normally becomes a separate PDF. For example, 1–3, 5–5 and 7–9 produce three files. Select “Merge all ranges in one PDF file” to combine them into one seven-page document. In Pages → Select pages, use “Merge extracted pages into one PDF file” for the same outcome. Fixed page groups and file-size splitting intentionally create multiple documents. Check the expected output count and preview before downloading.",
    related: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "guide", id: "guide-how-pdf-splitting-works" },
    ],
  },
  {
    type: "help",
    id: "help-why-isnt-my-split-pdf-working",
    slug: "why-isnt-my-split-pdf-working",
    path: "/help/why-isnt-my-split-pdf-working",
    title: "Why Isn't My Split PDF Working?",
    description:
      "Splitting can fail because of the file itself or the page ranges you entered. Here's how to tell which one it is.",
    question: "Why isn't my split PDF working?",
    answer:
      "First check that the source PDF opens and is an unlocked file you are authorized to use. In Range → Custom, every From and To value must be a whole number from 1 to the document’s page count, and the start must not exceed the end. Invalid ranges block the action instead of silently skipping pages. In Pages mode, select at least one valid page. In Size mode, enter a positive limit; a single page can still exceed it and produce a warning. Review the visible error, correct the selection or try a smaller document if your browser is short of memory.",
    related: [
      { type: "tool", id: "tool-split-pdf" },
      { type: "guide", id: "guide-how-to-choose-page-ranges-when-splitting-a-pdf" },
    ],
  },
  {
    type: "help",
    id: "help-why-did-i-get-multiple-images-from-one-pdf",
    slug: "why-did-i-get-multiple-images-from-one-pdf",
    path: "/help/why-did-i-get-multiple-images-from-one-pdf",
    title: "Why Did I Get Multiple Images From One PDF?",
    description:
      "PDF to JPG converts every page into its own image, not one combined picture. Here's what to expect.",
    question: "Why did I get multiple images from one PDF?",
    answer:
      "PDF to JPG converts every page of your document into its own separate JPG image — a 10-page PDF produces 10 JPG files, not one. This is expected: each page is rendered and exported individually, so there's no combined-image option. You can download each page's image on its own, or use \"Download All\" to get every page at once.",
    related: [
      { type: "tool", id: "tool-pdf-to-jpg" },
      { type: "guide", id: "guide-how-pdf-to-jpg-conversion-works" },
    ],
  },
  {
    type: "help",
    id: "help-can-i-choose-the-image-quality-for-pdf-to-jpg",
    slug: "can-i-choose-the-image-quality-for-pdf-to-jpg",
    path: "/help/can-i-choose-the-image-quality-for-pdf-to-jpg",
    title: "Can I Choose the Image Quality for PDF to JPG?",
    description:
      "Choose 150 or 300 DPI for full PDF pages and export JPG or PNG. Embedded images keep their decoded native dimensions.",
    question: "Can I choose the image quality for PDF to JPG?",
    answer:
      "Yes. In Full pages mode, choose High detail · 300 DPI or Smaller files · 150 DPI. You can also choose JPG or PNG. JPG uses lossy compression; PNG preserves the rendered pixels without lossy encoding. Higher resolution can create larger files, but cannot recover detail missing from the source. In Embedded images mode, pictures are extracted at their decoded native dimensions, so the full-page DPI setting does not upscale them.",
    related: [
      { type: "tool", id: "tool-pdf-to-jpg" },
      { type: "guide", id: "guide-what-resolution-are-pdf-to-jpg-images" },
      { type: "tool", id: "tool-compress-pdf" },
    ],
  },
  {
    type: "help",
    id: "help-can-i-reorder-my-images-before-converting-to-pdf",
    slug: "can-i-reorder-my-images-before-converting-to-pdf",
    path: "/help/can-i-reorder-my-images-before-converting-to-pdf",
    title: "Can I Reorder My Images Before Converting to PDF?",
    description:
      "Reorder JPG and PNG thumbnails before creating a PDF, sort images by filename, and rotate pages to get the sequence you need.",
    question: "Can I reorder my images before converting to PDF?",
    answer:
      "Yes. Drag the image thumbnails into the order you want, or sort them by filename before converting. You can also rotate individual images. Review the preview sequence, then choose whether to merge all images into one PDF or export separate PDFs. Keyboard users can focus the reorder handle and use the supported drag controls. You do not need to delete and re-add files just to change their order.",
    related: [
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "guide", id: "guide-how-jpg-to-pdf-conversion-works" },
      { type: "tool", id: "tool-merge-pdf" },
    ],
  },
  {
    type: "help",
    id: "help-why-are-my-pdf-pages-different-sizes-after-converting-from-jpg",
    slug: "why-are-my-pdf-pages-different-sizes-after-converting-from-jpg",
    path: "/help/why-are-my-pdf-pages-different-sizes-after-converting-from-jpg",
    title: "Why JPG-to-PDF Pages Have Different Sizes",
    description:
      "Image-sized pages follow each photo’s proportions. Choose A4 or Letter and a fixed orientation when you need consistent PDF page sizes.",
    question: "Why are my PDF pages different sizes after converting from JPG?",
    answer:
      "The image-sized setting follows each source image’s proportions, so a mixture of photo sizes can produce different PDF page sizes. Choose A4 or Letter for a common paper size, then select portrait or landscape rather than automatic orientation if every page must have the same orientation. Check the margins and previews before converting. Images are fitted without stretching or cropping; empty space is normal when an image’s proportions differ from the sheet.",
    related: [
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "guide", id: "guide-does-jpg-to-pdf-resize-my-images" },
    ],
  },
];

export function getHelp(path: string): HelpEntity | undefined {
  return HELP_ENTRIES.find((entry) => entry.path === path);
}
