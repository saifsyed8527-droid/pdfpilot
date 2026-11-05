'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { LocaleCode } from '@/lib/i18n/locales';
import { isLocaleIndexable } from "@/lib/i18n/indexable-locales";
import { localizedPath } from '@/lib/i18n/url-strategy';
import { resourceText, type ResourceDictionary } from '@/lib/i18n/resource-text';
const Context = createContext<{ locale: LocaleCode; words: ResourceDictionary }>({ locale:'en', words:{} });
export function ResourceLocaleProvider({ locale, words, children }: { locale: LocaleCode; words: ResourceDictionary; children: ReactNode }) {
  return <Context.Provider value={{locale,words}}>{children}</Context.Provider>;
}
export function useResourceI18n() {
  const {locale,words} = useContext(Context);
  return {
    locale,
    t: <T,>(value:T):T => typeof value === 'string' ? resourceText(words,value) as T : value,
    href: (value:string) => {
      if (!value.startsWith('/') || value.startsWith('//')) return value;
      const [path, ...hash] = value.split('#');
      if (!isLocaleIndexable(path,locale)) return value;
      return localizedPath(path,locale) + (hash.length ? '#' + hash.join('#') : '');
    },
  };
}
