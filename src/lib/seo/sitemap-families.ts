import { getIndexEntries } from './index-inventory';
import { getActiveLocales } from '../i18n/locales';
import { TOOLS } from '../tools';
import { xmlEscape, pseoSitemapChunks } from '../pseo/sitemap';
const base='https://pdfpilot.net';
export const SITEMAP_FAMILIES=['core','pt-br','locales','resources','workflows-templates'] as const;
export function sitemapFamily(path: string): typeof SITEMAP_FAMILIES[number] {
 if(path==='/pt-br'||path.startsWith('/pt-br/'))return 'pt-br';
 if(getActiveLocales().some(l=>l.code!=='en'&&(path===`/${l.segment}`||path.startsWith(`/${l.segment}/`))))return 'locales';
 if(path.startsWith('/templates')||path.startsWith('/pdf-workflows'))return 'workflows-templates';
 if(['/', '/about','/privacy','/terms'].includes(path)||TOOLS.some(t=>t.path===path))return 'core';
 return 'resources';
}
export function familyXml(family: string): string|undefined {
 if(!SITEMAP_FAMILIES.includes(family as typeof SITEMAP_FAMILIES[number]))return undefined;
 const entries=getIndexEntries().filter(e=>sitemapFamily(new URL(e.url).pathname)===family);
 return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.map(e=>`<url><loc>${xmlEscape(e.url)}</loc>${Object.entries(e.alternates?.languages??{}).map(([lang,url])=>`<xhtml:link rel="alternate" hreflang="${xmlEscape(lang)}" href="${xmlEscape(String(url))}"/>`).join('')}</url>`).join('')}</urlset>`;
}
export function sitemapIndexXml() {
 const urls=[...SITEMAP_FAMILIES.map(f=>`${base}/sitemaps/families/${f}.xml`),...pseoSitemapChunks().map(c=>`${base}/sitemaps/pseo/${c.id}.xml`)];
 return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<sitemap><loc>${url}</loc></sitemap>`).join('')}</sitemapindex>`;
}
