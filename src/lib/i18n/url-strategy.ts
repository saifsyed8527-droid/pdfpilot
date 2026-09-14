import { DEFAULT_LOCALE, getLocale, getLocaleBySegment, type LocaleCode } from "./locales";
import { CORE_PAGE_PATHS, getCorePageKeyFromPath, type CorePageKey } from "./core-content";

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

export function parseLocalizedPath(pathname: string): { locale: LocaleCode; path: string; pageKey?: CorePageKey } {
  const segments = pathname.split("/").filter(Boolean);
  const locale = segments[0] ? getLocaleBySegment(segments[0]) : undefined;
  if (!locale || locale.code === DEFAULT_LOCALE) {
    const path = pathname || "/";
    return { locale: DEFAULT_LOCALE, path, pageKey: getCorePageKeyFromPath(path) };
  }
  const slug = segments.slice(1).join("/");
  const pageKey = (Object.entries(CORE_PAGE_PATHS[locale.code]) as [CorePageKey, string][]).find(([, value]) => value === slug)?.[0];
  const path = pageKey ? (pageKey === "home" ? "/" : `/${CORE_PAGE_PATHS.en[pageKey]}`) : pathname;
  return { locale: locale.code, path, pageKey };
}
