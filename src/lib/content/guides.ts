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
    slug: "how-pdf-compression-works",
    path: "/guides/how-pdf-compression-works",
    title: "How PDF Compression Works",
    description:
      "Understand how PDF compression reduces file size, what you gain, and the one real trade-off to know about before you compress a document.",
    related: [{ type: "tool", path: "/compress-pdf" }],
    body: [
      "PDF compression makes a file smaller by re-encoding each page as a lower-resolution image rather than leaving its original text, vector graphics, and fonts untouched. That's why Compress PDF asks you to choose a quality level — Maximum Compression, Medium, or High Quality — each trading visual fidelity for a smaller file.",
      "Behind the scenes, every page is rendered to a canvas at your chosen scale, exported as a JPEG at a matching quality setting, and re-embedded into a new PDF. Photos and scanned pages usually compress well this way, since they were raster images to begin with.",
      "The trade-off worth knowing: because compression rebuilds each page as an image, any text in the original document is no longer selectable, searchable, or copyable in the compressed file. If you need to keep your PDF's text searchable, keep the original alongside the compressed copy, or skip compression for text-heavy documents where file size isn't a concern.",
      "As with every tool on PDFPilot, compression happens entirely in your browser — your file is never uploaded to a server.",
    ],
  },
];

export function getGuide(path: string): GuideEntity | undefined {
  return GUIDES.find((guide) => guide.path === path);
}
