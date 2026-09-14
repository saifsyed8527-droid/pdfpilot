import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { LocalizedHome, LocalizedToolPage } from "@/components/i18n/LocalizedCorePages";
import { CORE_COPY, CORE_PAGE_PATHS, getLocalizedToolContent, type CorePageKey, type CoreToolKey } from "@/lib/i18n/core-content";
import { getActiveLocales, getLocaleBySegment, type Locale, type LocaleCode } from "@/lib/i18n/locales";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { localizedCorePath } from "@/lib/i18n/url-strategy";
import { getBreadcrumbSchema, getFaqSchema, getSoftwareApplicationSchema } from "@/lib/seo";

type Params = Promise<{ locale: string; slug?: string[] }>;

function resolvePage(localeSegment: string, slugParts: string[] | undefined): { locale: Locale; pageKey: CorePageKey } | undefined {
  const locale = getLocaleBySegment(localeSegment);
  if (!locale || locale.code === "en" || !locale.active) return undefined;
  const slug = (slugParts ?? []).join("/");
  const pageKey = (Object.entries(CORE_PAGE_PATHS[locale.code]) as [CorePageKey, string][]).find(([, value]) => value === slug)?.[0];
  return pageKey ? { locale, pageKey } : undefined;
}

export function generateStaticParams() {
  return getActiveLocales()
    .filter((locale) => locale.code !== "en")
    .flatMap((locale) => (Object.entries(CORE_PAGE_PATHS[locale.code]) as [CorePageKey, string][]).map(([, slug]) => ({ locale: locale.segment, slug: slug ? [slug] : [] })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: segment, slug } = await params;
  const resolved = resolvePage(segment, slug);
  if (!resolved) return {};
  const { locale, pageKey } = resolved;
  const canonicalPath = pageKey === "home" ? "/" : `/${CORE_PAGE_PATHS.en[pageKey]}`;
  const url = localizedCorePath(pageKey, locale.code);
  const pageCopy = pageKey === "home" ? CORE_COPY[locale.code].home : getLocalizedToolContent(locale.code, pageKey);
  const title = pageCopy.seoTitle;
  const description = pageCopy.seoDescription;
  return {
    title,
    description,
    alternates: { canonical: url, languages: getHreflangLanguagesMap(canonicalPath) },
    openGraph: { type: "website", siteName: "PDFPilot", locale: locale.ogLocale, alternateLocale: getActiveLocales().filter((item) => item.code !== locale.code).map((item) => item.ogLocale), title, description, url, images: [{ url: pageKey === "home" ? "/og/home.png" : `/og/${CORE_PAGE_PATHS.en[pageKey]}.png`, width: 1200, height: 630, type: "image/png", alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [pageKey === "home" ? "/og/home.png" : `/og/${CORE_PAGE_PATHS.en[pageKey]}.png`] },
  };
}

export default async function LocalizedPage({ params }: { params: Params }) {
  const { locale: segment, slug } = await params;
  const resolved = resolvePage(segment, slug);
  if (!resolved) notFound();
  const { locale, pageKey } = resolved;

  if (pageKey === "home") return <LocalizedHome locale={locale.code} />;

  const toolKey = pageKey as CoreToolKey;
  const tool = getLocalizedToolContent(locale.code, toolKey);
  const localizedPath = localizedCorePath(pageKey, locale.code);
  return (
    <>
      <JsonLd data={[
        getSoftwareApplicationSchema({ name: tool.title, path: localizedPath, description: tool.seoDescription, inLanguage: locale.code }),
        getBreadcrumbSchema([{ name: "PDFPilot", path: localizedCorePath("home", locale.code) }, { name: tool.title, path: localizedPath }]),
        getFaqSchema([...tool.faqs], locale.code),
      ]} />
      <LocalizedToolPage locale={locale.code as LocaleCode} toolKey={toolKey} />
    </>
  );
}
