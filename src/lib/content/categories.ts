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
    slug: "optimize",
    path: "/categories/optimize",
    title: "Compress & Optimize PDFs",
    description: "Tools and guides for reducing PDF file size without losing what matters.",
    contains: [
      { type: "tool", path: "/compress-pdf" },
      { type: "guide", path: "/guides/how-pdf-compression-works" },
    ],
  },
];

export function getCategory(path: string): CategoryEntity | undefined {
  return CATEGORIES.find((category) => category.path === path);
}
