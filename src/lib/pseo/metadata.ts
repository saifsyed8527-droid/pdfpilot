import { PSEO_PAGES } from "./registry";
import type { Metadata } from "next";
import type { PseoPage } from "./schema";
export function intentMetadata(page: PseoPage): Metadata {
  const equivalents = PSEO_PAGES.filter(p => p.baseToolId === page.baseToolId && p.pageType === page.pageType && p.modifierValue === page.modifierValue);
  const fallback = equivalents.find(p => p.language === "en") ?? page;
  return { title: { absolute: page.metaTitle }, description: page.metaDescription,
    alternates: { canonical: page.canonicalUrl, languages: { ...Object.fromEntries(equivalents.map(p => [p.language, p.canonicalUrl])), "x-default": fallback.canonicalUrl } }, robots: { index: page.indexable, follow: true },
    openGraph: { type: "website", siteName: "PDFPilot", title: page.metaTitle, description: page.metaDescription, url: page.canonicalUrl, locale: page.language==="pt-BR"?"pt_BR":"en_US", images: [`/og/${page.baseToolSlug}.png`] },
    twitter: { card: "summary_large_image", title: page.metaTitle, description: page.metaDescription, images: [`/og/${page.baseToolSlug}.png`] },
  };
}
/** Describes visible page content, without invented ratings or FAQ/HowTo rich-result promises. */
export function intentSchema(page: PseoPage) {
  return { "@context": "https://schema.org", "@type": "WebPage", "@id": `${page.canonicalUrl}#page`, url: page.canonicalUrl, name: page.h1, description: page.intro, inLanguage: page.language,
    isPartOf: { "@id": "https://pdfpilot.net/#website" }, about: { "@id": `https://pdfpilot.net/${page.baseToolSlug}#software` } };
}
