import { sitemapIndexXml } from '@/lib/seo/sitemap-families';
export function GET(){return new Response(sitemapIndexXml(),{headers:{'Content-Type':'application/xml; charset=utf-8'}});}
