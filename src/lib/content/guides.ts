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
      "As with every tool on PDFPilot, compression happens entirely in your browser — your file is never uploaded to a server.",
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
      "As with every tool on PDFPilot, this happens entirely in your browser. Your file is never uploaded to a server, at any quality setting.",
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
      "As with every tool on PDFPilot, merging happens entirely in your browser. Your files are never uploaded to a server.",
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
      "As with every tool on PDFPilot, merging happens entirely in your browser, and your files are never uploaded to a server.",
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
      "As with every tool on PDFPilot, splitting happens entirely in your browser — your file is never uploaded to a server.",
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
      "As with every tool on PDFPilot, conversion happens entirely in your browser. Your file is never uploaded to a server.",
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
      "As with every tool on PDFPilot, this happens entirely in your browser. Your images are never uploaded to a server.",
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
];

export function getGuide(path: string): GuideEntity | undefined {
  return GUIDES.find((guide) => guide.path === path);
}
