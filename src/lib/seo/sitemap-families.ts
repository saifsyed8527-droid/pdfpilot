import { getIndexEntries } from './index-inventory';
import { getActiveLocales } from '../i18n/locales';
import { TOOLS } from '../tools';
import { xmlEscape, pseoSitemapChunks } from '../pseo/sitemap';
import { connectionSitemapUrls } from '../connections/sitemap';
const base='https://pdfpilot.net';
export const SITEMAP_FAMILIES=['core','pt-br','locales','resources','workflows-templates'] as const;
const FAMILY_CHUNK_SIZE = 1000;
export function sitemapFamily(path: string): typeof SITEMAP_FAMILIES[number] {
 if(path==='/pt-br'||path.startsWith('/pt-br/'))return 'pt-br';
 if(getActiveLocales().some(l=>l.code!=='en'&&(path===`/${l.segment}`||path.startsWith(`/${l.segment}/`))))return 'locales';
 if(path.startsWith('/templates')||path.startsWith('/pdf-workflows'))return 'workflows-templates';
 if(['/', '/about','/privacy','/terms'].includes(path)||TOOLS.some(t=>t.path===path))return 'core';
 return 'resources';
}
/** Hreflang multiplies XML size; bound each response well below the hosting limit. */
export function familySitemapChunks() {
 const inventory = getIndexEntries();
 return SITEMAP_FAMILIES.flatMap(family => {
  const entries = inventory.filter(entry => sitemapFamily(new URL(entry.url).pathname) === family);
  const count = Math.ceil(entries.length / FAMILY_CHUNK_SIZE);
  return Array.from({length: count}, (_, index) => ({
   id: count === 1 ? family : `${family}-${index}`, family,
   entries: entries.slice(index * FAMILY_CHUNK_SIZE, (index + 1) * FAMILY_CHUNK_SIZE),
  }));
 });
}
function indexXml(urls: string[]) {
 return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<sitemap><loc>${xmlEscape(url)}</loc></sitemap>`).join('')}</sitemapindex>`;
}
export function familyXml(id: string): string|undefined {
 const chunks = familySitemapChunks();
 const chunk = chunks.find(row => row.id === id);
 if (!chunk) {
  // Preserve an old submitted family URL as an index after it grows into chunks.
  const family = chunks.filter(row => row.family === id);
  return family.length > 1 ? indexXml(family.map(row => `${base}/sitemaps/families/${row.id}.xml`)) : undefined;
 }
 return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${chunk.entries.map(e=>`<url><loc>${xmlEscape(e.url)}</loc>${Object.entries(e.alternates?.languages??{}).map(([lang,url])=>`<xhtml:link rel="alternate" hreflang="${xmlEscape(lang)}" href="${xmlEscape(String(url))}"/>`).join('')}</url>`).join('')}</urlset>`;
}
export function sitemapIndexXml() {
 const urls=[...familySitemapChunks().map(c=>`${base}/sitemaps/families/${c.id}.xml`),...pseoSitemapChunks().map(c=>`${base}/sitemaps/pseo/${c.id}.xml`),...connectionSitemapUrls()];
 return indexXml(urls);
}
