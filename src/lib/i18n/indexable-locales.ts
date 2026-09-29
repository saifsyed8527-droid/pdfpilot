import type { LocaleCode } from "./locales";
// Audited supporting-copy coverage, not every route the locale router can render.
const established = new Set(["/", "/merge-pdf", "/split-pdf", "/compress-pdf", "/pdf-to-jpg", "/jpg-to-pdf"]);
const portuguese = new Set(["/", "/jpg-to-pdf", "/word-to-pdf", "/powerpoint-to-pdf", "/excel-to-pdf", "/html-to-pdf", "/pdf-to-jpg", "/pdf-to-word", "/pdf-to-powerpoint", "/pdf-to-excel", "/pdf-to-pdfa", "/merge-pdf", "/split-pdf", "/delete-pages", "/organize-pdf", "/rotate-pdf", "/compress-pdf", "/scan-pdf", "/crop-pdf", "/edit-pdf", "/fill-pdf"]);
export function isLocaleIndexable(path: string, locale: LocaleCode): boolean {
 return locale === "en" || (locale === "pt-BR" ? portuguese.has(path) : established.has(path));
}
