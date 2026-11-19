import resourcePages from "../i18n/resource-pages.json";
import resourceAliases from "../i18n/resource-aliases.json";
import { getActiveLocales } from "../i18n/locales";

function resourceOwns(url: string): boolean {
  const path = new URL(url).pathname;
  if (Object.hasOwn(resourcePages, path)) return true;
  if (Object.values(resourceAliases as Record<string, Record<string, string>>).some(aliases => Object.values(aliases).includes(path))) return true;
  return getActiveLocales().some(locale => locale.segment && path.startsWith(`/${locale.segment}/`) && Object.hasOwn(resourcePages, path.slice(locale.segment.length + 1)));
}
import { PSEO_PAGES } from "./registry";
// All standalone intent landing pages are retired; no public sitemap ownership.
export function pseoSitemapChunks(_input = PSEO_PAGES): { id: string; pages: typeof PSEO_PAGES }[] { return []; }
export const xmlEscape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
export function pseoSitemapIndex() {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pseoSitemapChunks().map(c=>`<sitemap><loc>https://pdfpilot.net/sitemaps/pseo/${c.id}.xml</loc></sitemap>`).join("")}</sitemapindex>`;
}
export function pseoSitemapXml(id: string): string | undefined {
  const chunk=pseoSitemapChunks().find(c=>`${c.id}.xml`===id);
  if(!chunk)return undefined;
  // Resource families own shared URLs and retain their reciprocal hreflang.
  // Old submitted pSEO endpoints stay valid but no longer repeat those URLs.
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${chunk.pages.filter(p => !resourceOwns(p.canonicalUrl)).map(p=>`<url><loc>${xmlEscape(p.canonicalUrl)}</loc><lastmod>${p.updatedAt}</lastmod></url>`).join("")}</urlset>`;
}
