import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { LocalizedGenericToolPage, LocalizedHome, LocalizedToolPage } from "@/components/i18n/LocalizedCorePages";
import { CORE_COPY, CORE_PAGE_PATHS, getLocalizedToolContent, type CorePageKey, type CoreToolKey } from "@/lib/i18n/core-content";
import { getActiveLocales, getLocaleBySegment, type Locale, type LocaleCode } from "@/lib/i18n/locales";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { localizedCorePath } from "@/lib/i18n/url-strategy";
import { getBreadcrumbSchema, getFaqSchema, getSoftwareApplicationSchema } from "@/lib/seo";
import { getLocalizedToolBySlug, getLocalizedToolDescription, getLocalizedToolTitle } from "@/lib/i18n/localized-tools";
import { TOOLS, type Tool } from "@/lib/tools";

type Params = Promise<{ locale: string; slug?: string[] }>;

type ResolvedPage = { locale: Locale; pageKey: CorePageKey; tool?: undefined } | { locale: Locale; pageKey?: undefined; tool: Tool };

function resolvePage(localeSegment: string, slugParts: string[] | undefined): ResolvedPage | undefined {
  const locale = getLocaleBySegment(localeSegment);
  if (!locale || locale.code === "en" || !locale.active) return undefined;
  const slug = (slugParts ?? []).join("/");
  const pageKey = (Object.entries(CORE_PAGE_PATHS[locale.code]) as [CorePageKey, string][]).find(([, value]) => value === slug)?.[0];
  if (pageKey) return { locale, pageKey };
  if (slugParts?.length === 1) {
    const tool = getLocalizedToolBySlug(slug);
    if (tool) return { locale, tool };
  }
  return undefined;
}

export function generateStaticParams() {
  return getActiveLocales()
    .filter((locale) => locale.code !== "en")
    .flatMap((locale) => [
      ...(Object.entries(CORE_PAGE_PATHS[locale.code]) as [CorePageKey, string][]).map(([, slug]) => ({ locale: locale.segment, slug: slug ? [slug] : [] })),
      ...TOOLS.filter((tool) => !Object.values(CORE_PAGE_PATHS.en).includes(tool.slug)).map((tool) => ({ locale: locale.segment, slug: [tool.slug] })),
    ]);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: segment, slug } = await params;
  const resolved = resolvePage(segment, slug);
  if (!resolved) return {};
  const { locale } = resolved;
  if (resolved.tool) {
    const title = getLocalizedToolTitle(resolved.tool, locale.code);
    const description = getLocalizedToolDescription(resolved.tool, locale.code);
    const canonicalPath = resolved.tool.path;
    return {
      title,
      description,
      alternates: { canonical: `/${locale.segment}/${resolved.tool.slug}`, languages: getHreflangLanguagesMap(canonicalPath) },
      openGraph: { type: "website", siteName: "PDFPilot", locale: locale.ogLocale, title, description, url: `/${locale.segment}/${resolved.tool.slug}`, images: [{ url: `/og/${resolved.tool.slug}.png`, width: 1200, height: 630, type: "image/png", alt: title }] },
      twitter: { card: "summary_large_image", title, description, images: [`/og/${resolved.tool.slug}.png`] },
    };
  }
  const { pageKey } = resolved;
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
  const { locale } = resolved;
  if (resolved.tool) {
    return (
      <>
        <JsonLd data={[
          getSoftwareApplicationSchema({ name: resolved.tool.name, path: resolved.tool.path, description: resolved.tool.description, inLanguage: locale.code }),
          getBreadcrumbSchema([{ name: "PDFPilot", path: `/${locale.segment}` }, { name: resolved.tool.name, path: `/${locale.segment}/${resolved.tool.slug}` }]),
        ]} />
        <LocalizedGenericToolPage locale={locale.code} tool={resolved.tool} />
      </>
    );
  }
  const { pageKey } = resolved;

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
