import type { Metadata } from "next";
export function pseoMetadata(title: string, description: string, path: string, image?: string): Metadata {
  return { title: `${title} | PDFPilot`, description, alternates: { canonical: path }, openGraph: { type: "website", title, description, url: path, locale: "en_US", ...(image ? { images: [image] } : {}) }, twitter: { card: "summary_large_image", title, description, ...(image ? { images: [image] } : {}) } };
}
export function collectionSchema(name: string, path: string, items: { title: string; path: string }[]) {
  return { "@context": "https://schema.org", "@type": "CollectionPage", name, url: `https://pdfpilot.net${path}`, inLanguage: "en", mainEntity: { "@type": "ItemList", itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.title, url: `https://pdfpilot.net${item.path}` })) } };
}
