import { ResourceLocaleProvider } from "./ResourceLocaleProvider";
import clientKeys from "@/lib/i18n/resource-client-keys.json";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/JsonLd';
import { resourceDictionary, resourceText, type ResourceDictionary } from '@/lib/i18n/resource-copy';
import { loadResourceRoute, resourceInfo } from '@/lib/i18n/resource-routes';
import { getHreflangLanguagesMap } from '@/lib/i18n/hreflang';
import { localizedPath } from '@/lib/i18n/url-strategy';
import { isLocaleIndexable } from '@/lib/i18n/indexable-locales';
import type { Locale } from '@/lib/i18n/locales';
import holds from '@/lib/content/search-holds.json';

function localHref(href: string, locale: Locale) {
  const internal = href.startsWith('/') && !href.startsWith('//') || href.startsWith('https://pdfpilot.net/');
  if (!internal) return href;
  const url = new URL(href, 'https://pdfpilot.net');
  if (!isLocaleIndexable(url.pathname, locale.code)) return href;
  const path = localizedPath(url.pathname, locale.code) + url.search + url.hash;
  return href.startsWith('https:') ? 'https://pdfpilot.net' + path : path;
}
function translateSchema(value: unknown, words: ResourceDictionary, locale: Locale, key = ''): unknown {
  if (typeof value === 'string') {
    if (key === 'inLanguage') return locale.code;
    if (key === '@id' && /#(website|organization)$/.test(value)) return value;
    if (['url', '@id', 'item'].includes(key)) return localHref(value, locale);
    return ['name', 'headline', 'description', 'text', 'articleBody'].includes(key) ? resourceText(words, value) : value;
  }
  if (Array.isArray(value)) return value.map(item => translateSchema(item, words, locale, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, translateSchema(v, words, locale, k)]));
  return value;
}
/** Translate server-rendered content before HTML is sent. Client processing props,
 * sample files, enum settings and file contents retain their original values. */
async function localize(node: ReactNode, words: ResourceDictionary, locale: Locale, clientWords: ResourceDictionary): Promise<ReactNode> {
  if (typeof node === 'string') return resourceText(words, node);
  if (Array.isArray(node)) {
    const children = await Promise.all(node.map(child => localize(child, words, locale, clientWords)));
    return children.map((child, index) => isValidElement(child) && child.key === null ? cloneElement(child, { key: `resource-${index}` }) : child);
  }
  if (node && typeof node === 'object' && 'then' in node) return localize(await node, words, locale, clientWords);
  if (!isValidElement<Record<string, unknown>>(node)) return node;
  if (node.type === 'script' && node.props.type === 'application/ld+json') {
    const html = (node.props.dangerouslySetInnerHTML as { __html: string }).__html;
    return <JsonLd data={translateSchema(JSON.parse(html), words, locale) as object} />;
  }
  if (node.type === JsonLd) return <JsonLd data={translateSchema(node.props.data, words, locale) as object} />;
  const type = node.type as unknown as { $$typeof?: symbol };
  if (typeof node.type === 'function' && type.$$typeof !== Symbol.for('react.client.reference')) {
    const Component = node.type as (props: Record<string, unknown>) => ReactNode | Promise<ReactNode>;
    return localize(await Component(node.props), words, locale, clientWords);
  }
  collectClientWords(node.props, words, clientWords);
  const props: Record<string, unknown> = {};
  if ('children' in node.props) props.children = await localize(node.props.children as ReactNode, words, locale, clientWords);
  for (const key of ['title','alt','aria-label','placeholder', ...(typeof node.type === 'string' ? [] : ['name','description','privacy'])]) {
    if (typeof node.props[key] === 'string') props[key] = resourceText(words, node.props[key]);
  }
  if (node.props.landingCopy && typeof node.props.landingCopy === 'object') {
    props.landingCopy = Object.fromEntries(Object.entries(node.props.landingCopy).map(([key,value]) => [key, typeof value === 'string' ? resourceText(words,value) : value]));
  }
  for (const key of ['href','toolPath','action']) if (typeof node.props[key] === 'string') props[key] = localHref(node.props[key], locale);
  return cloneElement(node as ReactElement<Record<string, unknown>>, props);
}
function collectClientWords(value: unknown, words: ResourceDictionary, selected: ResourceDictionary): void {
  if (typeof value === "string") { const key=value.replace(/\s+/g," ").trim(); if (words[key]) selected[key]=words[key]; }
  else if (Array.isArray(value)) value.forEach(item=>collectClientWords(item,words,selected));
  else if (value && typeof value === "object" && !isValidElement(value)) Object.entries(value).forEach(([key,item])=>{if(key!=="children") collectClientWords(item,words,selected);});
}
export async function resourceMetadata(path: string, locale: Locale, hasQuery = false): Promise<Metadata> {
  const page = resourceInfo(path); if (!page) return {};
  const words = await resourceDictionary(locale.code), title = resourceText(words, page.title), description = resourceText(words, page.description), canonical = localizedPath(path, locale.code);
  return { title: { absolute: title }, description, robots: { index: !hasQuery && !Object.hasOwn(holds,path), follow: true },
    alternates: { canonical, languages: getHreflangLanguagesMap(path) },
    openGraph: { type:'website', title, description, url: canonical, locale: locale.ogLocale, siteName:'PDFPilot', images:['/og/home.png'] },
    twitter: { card:'summary_large_image', title, description, images:['/og/home.png'] } };
}
export async function LocalizedResourcePage({ path, locale, searchParams = {} }: { path: string; locale: Locale; searchParams?: Record<string,string|string[]|undefined> }) {
  const route = await loadResourceRoute(path); if (!route) notFound();
  const words = await resourceDictionary(locale.code);
  const Page = route.module.default as (props: { params: Promise<{ slug: string; tool: string; template: string; category: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) => ReactNode | Promise<ReactNode>;
  const clientWords = Object.fromEntries(clientKeys.filter(key => words[key]).map(key => [key,words[key]]));
  const content = await localize(await Page({params:Promise.resolve(route.params),searchParams:Promise.resolve(searchParams)}), words, locale, clientWords);
  return <ResourceLocaleProvider locale={locale.code} words={clientWords}><div lang={locale.code} dir={locale.dir}>{content}</div></ResourceLocaleProvider>;
}
