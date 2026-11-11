import resourcePages from "../i18n/resource-pages.json";
import resourceAliases from "../i18n/resource-aliases.json";
import { getActiveLocales } from "../i18n/locales";

function resourceOwns(url: string): boolean {
  const path = new URL(url).pathname;
  if (Object.hasOwn(resourcePages, path)) return true;
  if (Object.values(resourceAliases).some(aliases => Object.values(aliases).includes(path))) return true;
  return getActiveLocales().some(locale => locale.segment && path.startsWith(`/${locale.segment}/`) && Object.hasOwn(resourcePages, path.slice(locale.segment.length + 1)));
}
import { PSEO_PAGES } from "./registry";
const SIZE = 5000;
const families = ["format", "size", "platform", "device", "use-case", "workflow"] as const;
export function pseoSitemapChunks(input = PSEO_PAGES) {
  return ["en","pt-BR"].flatMap(language => families.flatMap(family => {
    const pages = input.filter(p => p.language === language && p.pageType === family && p.indexable && ["approved", "published"].includes(p.qualityStatus) && !p.fixture);
    return Array.from({ length: Math.ceil(pages.length / SIZE) }, (_, i) => ({ id: `${language === "en" ? "" : "pt-br-"}${family}-${i}`, pages: pages.slice(i * SIZE, (i + 1) * SIZE) }));
  }));
}
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
