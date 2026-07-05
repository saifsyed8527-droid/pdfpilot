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
];

export function getComparison(path: string): ComparisonEntity | undefined {
  return COMPARISONS.find((comparison) => comparison.path === path);
}
