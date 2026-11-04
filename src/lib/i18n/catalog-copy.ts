import operations from "./catalog-operations.json";
import conversions from "./catalog-conversions.json";
import language from "./catalog-language.json";
import type { LocaleCode } from "./locales";

type Language = Exclude<LocaleCode, "en">;
const actions: Record<string, Record<Language, string[]>> = operations;
const pairs = new Set(conversions);
export const hasCatalogCopy = (slug: string) => Object.hasOwn(actions, slug) || pairs.has(slug);

const formats: Record<string, string> = {
  excel: "Excel", heic: "HEIC", pdf: "PDF", svg: "SVG", jpg: "JPG", png: "PNG", markdown: "Markdown",
  html: "HTML", txt: "TXT", csv: "CSV", tsv: "TSV", sql: "SQL", xml: "XML", json: "JSON", yaml: "YAML",
};
function formatName(format: string, locale: Language) {
  if (format === "text" || format === "image" || format === "markdown-table") return language[locale][format];
  return formats[format];
}
export function catalogCopy(slug: string, locale: Language) {
  if (Object.hasOwn(actions, slug)) {
    const [name, summary] = actions[slug][locale];
    return { name, summary };
  }
  if (!pairs.has(slug)) return undefined;
  const [input, output] = slug.split("-to-");
  const from = formatName(input, locale), to = formatName(output, locale);
  const fill = (value: string) => value.replace("{from}", from).replace("{to}", to);
  return { name: fill(language[locale].pairTitle), summary: fill(language[locale].pairSummary) };
}

function reviewKey(slug: string) {
  if (slug.includes("sql")) return "sql";
  if (slug.includes("json") || slug.includes("xml") || slug.includes("yaml")) return "structure";
  if (/csv|excel|tsv|column|duplicate-row/.test(slug)) return "table";
  if (/base64|url-|jwt-/.test(slug)) return "strings";
  if (/image|heic|photo|background|meme|blur-face|pdf-to-jpg/.test(slug) && slug !== "ocr-image") return "pixels";
  if (/word|markdown|html|powerpoint|txt-|ocr-|translate|summary|pdf-to-|docx|svg-to/.test(slug)) return "document";
  return "pages";
}
export function catalogGuidance(slug: string, locale: Language) {
  const words = language[locale];
  return { check: words.check, note: words[reviewKey(slug)], related: words.related };
}
