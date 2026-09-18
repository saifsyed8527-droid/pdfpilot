import { DEFAULT_LOCALE, getLocale, getLocaleBySegment, type LocaleCode } from "./locales";
import { CORE_PAGE_PATHS, getCorePageKeyFromPath, type CorePageKey } from "./core-content";
import { getTool } from "@/lib/tools";

export function localizedPath(path: string, localeCode: string): string {
  const locale = getLocale(localeCode);
  if (!locale || locale.code === DEFAULT_LOCALE) return path;
  const pageKey = getCorePageKeyFromPath(path);
  const slug = pageKey ? CORE_PAGE_PATHS[locale.code][pageKey] : path.replace(/^\//, "");
  return slug ? `/${locale.segment}/${slug}` : `/${locale.segment}`;
}

export function localizedCorePath(pageKey: CorePageKey, localeCode: LocaleCode): string {
  const englishPath = pageKey === "home" ? "/" : `/${CORE_PAGE_PATHS.en[pageKey]}`;
  return localizedPath(englishPath, localeCode);
}

export function localizedToolPath(slug: string, localeCode: LocaleCode): string {
  const coreKey = getCorePageKeyFromPath(`/${slug}`);
  return coreKey ? localizedCorePath(coreKey, localeCode) : localizedPath(`/${slug}`, localeCode);
}

export function parseLocalizedPath(pathname: string): { locale: LocaleCode; path: string; pageKey?: CorePageKey; toolPath?: string } {
  const segments = pathname.split("/").filter(Boolean);
  const locale = segments[0] ? getLocaleBySegment(segments[0]) : undefined;
  if (!locale || locale.code === DEFAULT_LOCALE) {
    const path = pathname || "/";
    const pageKey = getCorePageKeyFromPath(path);
    const toolPath = getTool(path)?.path;
    return { locale: DEFAULT_LOCALE, path, pageKey, toolPath };
  }
  const slug = segments.slice(1).join("/");
  const pageKey = (Object.entries(CORE_PAGE_PATHS[locale.code]) as [CorePageKey, string][]).find(([, value]) => value === slug)?.[0];
  const tool = !pageKey && segments.length === 2 ? getTool(`/${segments[1]}`) : undefined;
  const path = pageKey ? (pageKey === "home" ? "/" : `/${CORE_PAGE_PATHS.en[pageKey]}`) : tool?.path ?? pathname;
  return { locale: locale.code, path, pageKey, toolPath: tool?.path };
}
