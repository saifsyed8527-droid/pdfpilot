import type { Metadata } from "next";
import type { PseoPage } from "./schema";
export function intentMetadata(page: PseoPage): Metadata {
  return { title: { absolute: page.metaTitle }, description: page.metaDescription,
    alternates: { canonical: page.canonicalUrl }, robots: { index: page.indexable, follow: true },
    openGraph: { type: "website", siteName: "PDFPilot", title: page.metaTitle, description: page.metaDescription, url: page.canonicalUrl, locale: "en_US", images: [`/og/${page.baseToolSlug}.png`] },
    twitter: { card: "summary_large_image", title: page.metaTitle, description: page.metaDescription, images: [`/og/${page.baseToolSlug}.png`] },
  };
}
/** Describes visible page content, without invented ratings or FAQ/HowTo rich-result promises. */
export function intentSchema(page: PseoPage) {
  return { "@context": "https://schema.org", "@type": "WebPage", "@id": `${page.canonicalUrl}#page`, url: page.canonicalUrl, name: page.h1, description: page.intro, inLanguage: page.language,
    isPartOf: { "@id": "https://pdfpilot.net/#website" }, about: { "@id": `https://pdfpilot.net/${page.baseToolSlug}#software` } };
}
