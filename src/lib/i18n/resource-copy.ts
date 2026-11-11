import { isPreviewLocale, type LocaleCode } from './locales';
import type { ResourceDictionary } from "./resource-text";
export { resourceText, type ResourceDictionary } from "./resource-text";
export async function resourceDictionary(locale: LocaleCode): Promise<ResourceDictionary> {
  if (locale === 'en' || isPreviewLocale(locale)) return {};
  const dictionaries = {
    es: () => import('./resources/es.json'), 'pt-BR': () => import('./resources/pt-BR.json'),
    de: () => import('./resources/de.json'), fr: () => import('./resources/fr.json'),
    hi: () => import('./resources/hi.json'), id: () => import('./resources/id.json'),
    'zh-CN': () => import('./resources/zh-CN.json'), ja: () => import('./resources/ja.json'),
    ko: () => import('./resources/ko.json'), ar: () => import('./resources/ar.json'), ru: () => import('./resources/ru.json'),
  };
  return (await dictionaries[locale as keyof typeof dictionaries]()).default;
}
