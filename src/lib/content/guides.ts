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
];

export function getGuide(path: string): GuideEntity | undefined {
  return GUIDES.find((guide) => guide.path === path);
}
