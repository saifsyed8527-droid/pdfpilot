import { SITE_URL } from "./constants";

export interface BreadcrumbItemInput {
  /** Human-readable label, e.g. "Merge PDF" */
  name: string;
  /** Route path starting with "/", e.g. "/merge-pdf" */
  path: string;
}

export interface BreadcrumbListItem {
  "@type": "ListItem";
  position: number;
  name: string;
  item: string;
}

export interface BreadcrumbListSchema {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: BreadcrumbListItem[];
}

export function getBreadcrumbSchema(
  items: BreadcrumbItemInput[]
): BreadcrumbListSchema {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
