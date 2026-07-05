import { SITE_URL } from "./constants";

export interface CollectionItem {
  name: string;
  url?: string;
}

export interface CollectionPageSchema {
  "@context": "https://schema.org";
  "@type": "CollectionPage";
  name: string;
  description: string;
  url: string;
  mainEntity: {
    "@type": "ItemList";
    itemListElement: { "@type": "ListItem"; position: number; name: string; url?: string }[];
  };
}

export interface CollectionPageInput {
  name: string;
  description: string;
  path: string;
  items: CollectionItem[];
}

/**
 * Reused by Comparison, Use Case, and Category/Hub pages — each is
 * fundamentally "a curated list of real, named things" with no fabricated
 * ratings or scores attached.
 */
export function getCollectionPageSchema({
  name,
  description,
  path,
  items,
}: CollectionPageInput): CollectionPageSchema {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: `${SITE_URL}${path}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        ...(item.url ? { url: `${SITE_URL}${item.url}` } : {}),
      })),
    },
  };
}
