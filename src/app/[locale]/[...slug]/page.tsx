import { isResourcePath } from "@/lib/i18n/resource-routes";
import { LocalizedResourcePage, resourceMetadata } from "@/components/i18n/LocalizedResourcePage";
import { getPseoPage, PSEO_PAGES } from "@/lib/pseo/registry";
import { intentMetadata } from "@/lib/pseo/metadata";
import { IntentPage } from "@/components/pseo/IntentPage";
import { CoreToolHelp } from "@/components/seo/CoreToolHelp";
import { LocalizedToolGuide } from "@/components/i18n/LocalizedToolGuide";
import { toolSocialImage } from "@/lib/seo/tool-social-image";
import { hasLocalizedTool, isLocaleIndexable } from "@/lib/i18n/indexable-locales";
import ptHelp from "@/lib/content/pt-br-tool-help.json";
import type { Metadata } from "next";
import { conversionCopy, isConversionTool } from "@/lib/i18n/conversion-copy";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { CORE_COPY, CORE_PAGE_PATHS, getLocalizedToolContent, type CorePageKey, type CoreToolKey } from "@/lib/i18n/core-content";
import { isPreviewLocale, getActiveLocales, getLocaleBySegment, type Locale, type LocaleCode } from "@/lib/i18n/locales";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { localizedPath as resourceLocalizedPath, localizedCorePath, localizedToolPath } from "@/lib/i18n/url-strategy";
import { getBreadcrumbSchema, getFaqSchema, getSoftwareApplicationSchema } from "@/lib/seo";
import { localizedToolName } from "@/lib/i18n/ui-copy";
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
  return [...PSEO_PAGES.filter(p=>p.locale).map(p=>({locale:p.locale!,slug:[p.slug]})), ...getActiveLocales()
    .filter((locale) => locale.code !== "en")
    .flatMap((locale) => [
      ...(Object.entries(CORE_PAGE_PATHS[locale.code]) as [CorePageKey, string][]).filter(([, slug]) => Boolean(slug)).map(([, slug]) => ({ locale: locale.segment, slug: slug ? [slug] : [] })),
      ...TOOLS.filter((tool) => hasLocalizedTool(tool.slug) && !Object.values(CORE_PAGE_PATHS.en).includes(tool.slug)).map((tool) => ({ locale: locale.segment, slug: [tool.slug] })),
    ])];
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams?: Promise<Record<string,string|string[]|undefined>> }): Promise<Metadata> {
  const { locale: segment, slug } = await params;
  const resourceLocale = getLocaleBySegment(segment), resourcePath = "/" + (slug ?? []).join("/");
  if (resourceLocale?.active && resourceLocale.code !== "en" && !isPreviewLocale(resourceLocale.code) && isResourcePath(resourcePath)) return resourceMetadata(resourcePath, resourceLocale, Object.keys(await searchParams ?? {}).length > 0);
  const intent = slug?.length===1 ? getPseoPage(slug[0], segment) : undefined;
  if(intent) return intentMetadata(intent);
  const resolved = resolvePage(segment, slug);
  if (!resolved) return {};
  const { locale } = resolved;
  if (resolved.tool) {
    const reviewed = locale.code === "pt-BR" ? ptHelp[resolved.tool.slug as keyof typeof ptHelp] : undefined;
    const title = reviewed?.title ?? getLocalizedToolTitle(resolved.tool, locale.code);
    const description = reviewed?.description ?? (isConversionTool(resolved.tool.slug) ? conversionCopy(locale.code, resolved.tool.slug).description : getLocalizedToolDescription(resolved.tool, locale.code));
    const canonicalPath = resolved.tool.path;
    return {
      title,
      description,
      robots: { index: isLocaleIndexable(canonicalPath, locale.code), follow: true },
      alternates: { canonical: localizedToolPath(resolved.tool.slug,locale.code), languages: getHreflangLanguagesMap(canonicalPath) },
      openGraph: { type: "website", siteName: "PDFPilot", locale: locale.ogLocale, alternateLocale: getActiveLocales().filter(item => item.code !== locale.code).map(item => item.ogLocale), title, description, url: `/${locale.segment}/${resolved.tool.slug}`, images: [{ url: toolSocialImage(resolved.tool.slug), width: 1200, height: 630, type: "image/png", alt: title }] },
      twitter: { card: "summary_large_image", title, description, images: [toolSocialImage(resolved.tool.slug)] },
    };
  }
  const { pageKey } = resolved;
  const canonicalPath = pageKey === "home" ? "/" : `/${CORE_PAGE_PATHS.en[pageKey]}`;
  const url = localizedCorePath(pageKey, locale.code);
  const pageCopy = pageKey === "home" ? CORE_COPY[locale.code].home : getLocalizedToolContent(locale.code, pageKey);
  const reviewed = locale.code === "pt-BR" ? ptHelp[CORE_PAGE_PATHS.en[pageKey] as keyof typeof ptHelp] : undefined;
  const title = reviewed?.title ?? pageCopy.seoTitle;
  const description = reviewed?.description ?? pageCopy.seoDescription;
  return {
    title,
    description,
    robots: { index: isLocaleIndexable(canonicalPath, locale.code), follow: true },
    alternates: { canonical: url, languages: getHreflangLanguagesMap(canonicalPath) },
    openGraph: { type: "website", siteName: "PDFPilot", locale: locale.ogLocale, alternateLocale: getActiveLocales().filter((item) => item.code !== locale.code).map((item) => item.ogLocale), title, description, url, images: [{ url: pageKey === "home" ? "/og/home.png" : toolSocialImage(CORE_PAGE_PATHS.en[pageKey]), width: 1200, height: 630, type: "image/png", alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [pageKey === "home" ? "/og/home.png" : toolSocialImage(CORE_PAGE_PATHS.en[pageKey])] },
  };
}

export default async function LocalizedPage({ params, searchParams }: { params: Params; searchParams?: Promise<Record<string,string|string[]|undefined>> }) {
  const { locale: segment, slug } = await params;
  const resourceLocale = getLocaleBySegment(segment), resourcePath = "/" + (slug ?? []).join("/");
  if (resourceLocale?.active && resourceLocale.code !== "en" && !isPreviewLocale(resourceLocale.code) && isResourcePath(resourcePath)) {
    const canonical = resourceLocalizedPath(resourcePath, resourceLocale.code);
    if (canonical !== `/${segment}${resourcePath}`) permanentRedirect(canonical);
    return <LocalizedResourcePage path={resourcePath} locale={resourceLocale} searchParams={await searchParams} />;
  }
  const intent = slug?.length===1 ? getPseoPage(slug[0], segment) : undefined;
  if(intent) return <IntentPage page={intent}/>;
  const resolved = resolvePage(segment, slug);
  if (!resolved) notFound();
  const { LocalizedGenericToolPage, LocalizedHome, LocalizedToolPage } = await import("@/components/i18n/LocalizedCorePages");
  const { locale } = resolved;
  if (resolved.tool) {
    const canonical = localizedToolPath(resolved.tool.slug, locale.code);
    if (canonical !== `/${segment}/${(slug ?? []).join("/")}`) permanentRedirect(canonical);
    return (
      <>
        <JsonLd data={[
          getSoftwareApplicationSchema({ name: localizedToolName(resolved.tool.slug, locale.code, resolved.tool.name), path: localizedToolPath(resolved.tool.slug, locale.code), description: isConversionTool(resolved.tool.slug) ? conversionCopy(locale.code, resolved.tool.slug).description : getLocalizedToolDescription(resolved.tool, locale.code), inLanguage: locale.code }),
          getBreadcrumbSchema([{ name: "PDFPilot", path: `/${locale.segment}` }, { name: getLocalizedToolTitle(resolved.tool, locale.code), path: `/${locale.segment}/${resolved.tool.slug}` }]),
        ]} />
        <LocalizedGenericToolPage locale={locale.code} tool={resolved.tool} />
        <LocalizedToolGuide tool={resolved.tool} locale={locale.code} />
        <CoreToolHelp toolId={resolved.tool.slug} locale={locale.code} />
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
        ...(locale.code === "pt-BR" ? [] : [getFaqSchema([...tool.faqs], locale.code)]),
      ]} />
      <LocalizedToolPage locale={locale.code as LocaleCode} toolKey={toolKey} />
      <CoreToolHelp toolId={CORE_PAGE_PATHS.en[pageKey]} locale={locale.code} />
    </>
  );
}
