export type LocaleCode = "en" | "es" | "pt-BR" | "de" | "fr" | "hi" | "id";

export interface Locale {
  code: LocaleCode;
  segment: string;
  name: string;
  nativeName: string;
  dir: "ltr" | "rtl";
  ogLocale: string;
  active: boolean;
}

export const LOCALES: readonly Locale[] = [
  { code: "en", segment: "", name: "English", nativeName: "English", dir: "ltr", ogLocale: "en_US", active: true },
  { code: "es", segment: "es", name: "Spanish", nativeName: "Español", dir: "ltr", ogLocale: "es_ES", active: true },
  { code: "pt-BR", segment: "pt-br", name: "Brazilian Portuguese", nativeName: "Português (Brasil)", dir: "ltr", ogLocale: "pt_BR", active: true },
  { code: "de", segment: "de", name: "German", nativeName: "Deutsch", dir: "ltr", ogLocale: "de_DE", active: true },
  { code: "fr", segment: "fr", name: "French", nativeName: "Français", dir: "ltr", ogLocale: "fr_FR", active: true },
  { code: "hi", segment: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr", ogLocale: "hi_IN", active: true },
  { code: "id", segment: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr", ogLocale: "id_ID", active: true },
] as const;

export const DEFAULT_LOCALE: LocaleCode = "en";

export const getActiveLocales = (): readonly Locale[] => LOCALES.filter((locale) => locale.active);
export const getLocale = (code: string): Locale | undefined => LOCALES.find((locale) => locale.code.toLowerCase() === code.toLowerCase());
export const getLocaleBySegment = (segment: string): Locale | undefined => LOCALES.find((locale) => locale.segment === segment.toLowerCase());
export const isValidLocale = (code: string): code is LocaleCode => getLocale(code) !== undefined;
