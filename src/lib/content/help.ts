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
      "Compression rebuilds each page as a JPEG image at a resolution and quality tied to the setting you chose. Maximum Compression uses the lowest scale (0.6) and JPEG quality (0.5), which shrinks file size the most but also reduces sharpness — especially on pages with small text or fine detail. If a compressed page looks blurry, that's expected at that setting, not a malfunction. Choosing Medium or High Quality trades some file-size reduction for a sharper result. If you need to preserve both a small size and readable text, try Medium first and only drop to Maximum Compression if the file is still too large afterward.",
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
      "Compressing a PDF turns each page into an image, which is why the text is no longer selectable afterward. Here's what that means for your file.",
    question: "Why can't I select text in my compressed PDF?",
    answer:
      "Compress PDF works by rendering each page onto a canvas and re-encoding it as a JPEG image, then rebuilding the PDF from those images. That's what makes the file smaller — but it also means every page becomes a picture of your original content rather than the original text and fonts. Once a page is compressed this way, its text can no longer be selected, searched, or copied, even though it still looks correct. If you need a version of the file that keeps its text selectable, keep your original PDF alongside the compressed copy — compression isn't reversible, so the source file is the only place the text remains intact.",
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
      "Most email providers cap attachments somewhere between 10MB and 25MB, so the right setting depends on how large your original file is and how much you need to shrink it. Medium is a reasonable starting point — it reduces file size while keeping pages sharp enough to read comfortably. If the compressed file is still too large for your email provider's limit, switch to Maximum Compression for the smallest possible result. If your PDF has more pages than you actually need to send, extracting just the relevant pages first — before compressing — can reduce the size further than compression alone.",
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
      "If you entered more than one page range, Split PDF creates a separate file for each one. Here's why, and how to get a single file instead.",
    question: "Why did splitting my PDF create multiple files?",
    answer:
      "Split PDF creates one new file for every comma-separated range or page number you enter. If you entered \"1-3,5,7-9\", you'll get three files: one for pages 1-3, one for page 5, and one for pages 7-9 — each downloadable on its own or all at once. If you actually wanted all of those pages combined into a single file, enter them as one continuous range instead (for example, \"1-3,5,7-9\" would need to become separate steps, or you can merge the resulting files back together afterward using Merge PDF).",
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
      "There are two common causes. First, the file itself: if your PDF can't be opened at all — for example, if it's corrupted or password-protected — you'll see a \"Failed to load PDF\" error as soon as you upload it. Second, the page ranges: if you enter page numbers that don't exist in your document (for example, \"1-20\" for a 10-page file), those out-of-range pages are simply skipped rather than causing an error, so double-check the page count shown after upload and make sure your ranges fall within it.",
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
      "Unlike Compress PDF, PDF to JPG doesn't have adjustable quality settings. Here's what resolution and quality you actually get.",
    question: "Can I choose the image quality for PDF to JPG?",
    answer:
      "No — PDF to JPG always renders each page at a fixed 2x scale and exports it as a JPEG at a fixed quality of 0.9, so there's no quality picker like Compress PDF's Maximum Compression, Medium, and High Quality settings. In practice this fixed setting produces high-fidelity images suitable for most uses, since it favors image quality over file size by default.",
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
      "JPG to PDF doesn't support drag-and-drop reordering. Here's how to control the page order instead.",
    question: "Can I reorder my images before converting to PDF?",
    answer:
      "Not directly — unlike Merge PDF, JPG to PDF doesn't have a drag-and-drop reorder feature. Images become PDF pages in the order you upload them. If you need a different order, remove the images that are out of place using the delete button on each thumbnail, then re-add them in the order you want before converting.",
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
    title: "Why Are My PDF Pages Different Sizes After Converting From JPG?",
    description:
      "JPG to PDF sizes each page to match its source image exactly, so mixed image sizes produce mixed page sizes. Here's why.",
    question: "Why are my PDF pages different sizes after converting from JPG?",
    answer:
      "Each page in the resulting PDF is created at the exact pixel dimensions of the image it came from — there's no resizing to a standard page size like Letter or A4. If you combined photos taken at different resolutions or aspect ratios, the pages in your PDF will be different sizes too. This isn't a bug: it's how the tool preserves your images at their original dimensions rather than cropping or stretching them to fit a fixed page.",
    related: [
      { type: "tool", id: "tool-jpg-to-pdf" },
      { type: "guide", id: "guide-does-jpg-to-pdf-resize-my-images" },
    ],
  },
];

export function getHelp(path: string): HelpEntity | undefined {
  return HELP_ENTRIES.find((entry) => entry.path === path);
}
