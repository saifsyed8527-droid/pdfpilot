import { CONNECTION_CHUNK_SIZE, connectionCount, connectionSlice } from "./registry";
import { isToolOnlyLocale, getActiveLocales, getLocaleBySegment, type LocaleCode } from "../i18n/locales";
import { localizedPath } from "../i18n/url-strategy";
import { getHreflangLanguagesMap } from "../i18n/hreflang";
import { xmlEscape } from "../pseo/sitemap";

export function connectionSitemapUrls() {
  const chunks = Math.ceil(connectionCount() / CONNECTION_CHUNK_SIZE);
  return getActiveLocales().filter(locale => !isToolOnlyLocale(locale.code)).flatMap(locale => Array.from({ length: chunks }, (_, index) =>
    `https://pdfpilot.net/sitemaps/connections/${locale.segment || "en"}/${index}.xml`));
}
export function connectionSitemapXml(segment: string, page: string) {
  const locale = segment === "en" ? "en" : getLocaleBySegment(segment)?.code;
  if (!locale || isToolOnlyLocale(locale) || !/^(0|[1-9]\d*)\.xml$/.test(page)) return undefined;
  const offset = Number(page.slice(0, -4)) * CONNECTION_CHUNK_SIZE;
  if (!Number.isSafeInteger(offset) || offset >= connectionCount()) return undefined;
  const entries = connectionSlice(offset, CONNECTION_CHUNK_SIZE).map(path => {
    const alternate = Object.entries(getHreflangLanguagesMap(path)).map(([language, url]) => `<xhtml:link rel="alternate" hreflang="${xmlEscape(language)}" href="${xmlEscape(url)}"/>`).join("");
    return `<url><loc>https://pdfpilot.net${xmlEscape(localizedPath(path, locale as LocaleCode))}</loc>${alternate}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.join("")}</urlset>`;
}
