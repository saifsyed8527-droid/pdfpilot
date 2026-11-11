export type LocaleCode = "en" | "es" | "pt-BR" | "de" | "fr" | "hi" | "id" | "zh-CN" | "ja" | "ko" | "ar" | "ru" | "it" | "zh-TW" | "bg" | "ca" | "nl" | "el" | "ms" | "pl" | "sv" | "th" | "tr" | "uk" | "vi" | "sw";

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
  { code: "zh-CN", segment: "zh-cn", name: "Simplified Chinese", nativeName: "简体中文", dir: "ltr", ogLocale: "zh_CN", active: true },
  { code: "ja", segment: "ja", name: "Japanese", nativeName: "日本語", dir: "ltr", ogLocale: "ja_JP", active: true },
  { code: "ko", segment: "ko", name: "Korean", nativeName: "한국어", dir: "ltr", ogLocale: "ko_KR", active: true },
  { code: "ar", segment: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl", ogLocale: "ar_AR", active: true },
  { code: "ru", segment: "ru", name: "Russian", nativeName: "Русский", dir: "ltr", ogLocale: "ru_RU", active: true },
  { code: "it", segment: "it", name: "Italian", nativeName: "Italiano", dir: "ltr", ogLocale: "it_IT", active: true },
  { code: "zh-TW", segment: "zh-tw", name: "Traditional Chinese", nativeName: "中文（繁體）", dir: "ltr", ogLocale: "zh_TW", active: true },
  { code: "bg", segment: "bg", name: "Bulgarian", nativeName: "Български", dir: "ltr", ogLocale: "bg_BG", active: true },
  { code: "ca", segment: "ca", name: "Catalan", nativeName: "Català", dir: "ltr", ogLocale: "ca_ES", active: true },
  { code: "nl", segment: "nl", name: "Dutch", nativeName: "Nederlands", dir: "ltr", ogLocale: "nl_NL", active: true },
  { code: "el", segment: "el", name: "Greek", nativeName: "Ελληνικά", dir: "ltr", ogLocale: "el_GR", active: true },
  { code: "ms", segment: "ms", name: "Malay", nativeName: "Bahasa Melayu", dir: "ltr", ogLocale: "ms_MY", active: true },
  { code: "pl", segment: "pl", name: "Polish", nativeName: "Polski", dir: "ltr", ogLocale: "pl_PL", active: true },
  { code: "sv", segment: "sv", name: "Swedish", nativeName: "Svenska", dir: "ltr", ogLocale: "sv_SE", active: true },
  { code: "th", segment: "th", name: "Thai", nativeName: "ภาษาไทย", dir: "ltr", ogLocale: "th_TH", active: true },
  { code: "tr", segment: "tr", name: "Turkish", nativeName: "Türkçe", dir: "ltr", ogLocale: "tr_TR", active: true },
  { code: "uk", segment: "uk", name: "Ukrainian", nativeName: "Українська", dir: "ltr", ogLocale: "uk_UA", active: true },
  { code: "vi", segment: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", dir: "ltr", ogLocale: "vi_VN", active: true },
  { code: "sw", segment: "sw", name: "Swahili", nativeName: "Kiswahili", dir: "ltr", ogLocale: "sw_KE", active: true },
] as const;

export const DEFAULT_LOCALE: LocaleCode = "en";

export const getActiveLocales = (): readonly Locale[] => LOCALES.filter((locale) => locale.active);
export const getLocale = (code: string): Locale | undefined => LOCALES.find((locale) => locale.code.toLowerCase() === code.toLowerCase());
export const getLocaleBySegment = (segment: string): Locale | undefined => LOCALES.find((locale) => locale.segment === segment.toLowerCase());
export const isValidLocale = (code: string): code is LocaleCode => getLocale(code) !== undefined;

/** Languages with published homepages and tools; resource and integration translations are separate. */
export const TOOL_ONLY_LOCALE_CODES: readonly LocaleCode[] = ["it", "zh-TW", "bg", "ca", "nl", "el", "ms", "pl", "sv", "th", "tr", "uk", "vi", "sw"];
export const isToolOnlyLocale = (code: string) => TOOL_ONLY_LOCALE_CODES.includes(code as LocaleCode);
