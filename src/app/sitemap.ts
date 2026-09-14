import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";
import { GUIDES } from "@/lib/content/guides";
import { HELP_ENTRIES } from "@/lib/content/help";
import { COMPARISONS } from "@/lib/content/comparisons";
import { USE_CASES } from "@/lib/content/use-cases";
import { CATEGORIES } from "@/lib/content/categories";
import { INDUSTRIES } from "@/lib/content/industries";
import { GLOSSARY } from "@/lib/content/glossary";
import { CHECKLISTS } from "@/lib/content/checklists";
import { TEMPLATES } from "@/lib/content/templates";
import { CORE_PAGE_PATHS, type CorePageKey } from "@/lib/i18n/core-content";
import { getActiveLocales } from "@/lib/i18n/locales";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { localizedCorePath } from "@/lib/i18n/url-strategy";

const BASE_URL = "https://pdfpilot.net";

// Pages that aren't part of the Tool or content models (home + static utility pages).
const NON_TOOL_PAGES = ["/about", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    ...TOOLS.map((tool) => tool.path),
    ...NON_TOOL_PAGES,
    "/guides",
    ...GUIDES.map((guide) => guide.path),
    ...HELP_ENTRIES.map((entry) => entry.path),
    ...COMPARISONS.map((comparison) => comparison.path),
    ...USE_CASES.map((useCase) => useCase.path),
    "/categories",
    ...CATEGORIES.map((category) => category.path),
    ...INDUSTRIES.map((industry) => industry.path),
    ...GLOSSARY.map((entry) => entry.path),
    ...CHECKLISTS.map((checklist) => checklist.path),
    ...TEMPLATES.map((template) => template.path),
  ];

  const coreByEnglishPath = new Map(
    (Object.entries(CORE_PAGE_PATHS.en) as [CorePageKey, string][]).map(([key, slug]) => [slug ? `/${slug}` : "/", key])
  );

  const englishEntries: MetadataRoute.Sitemap = routes.map((route) => {
    const path = route || "/";
    const pageKey = coreByEnglishPath.get(path);
    return {
      url: `${BASE_URL}${path}`,
      ...(pageKey ? { alternates: { languages: getHreflangLanguagesMap(path) } } : {}),
    };
  });

  const localizedEntries: MetadataRoute.Sitemap = getActiveLocales()
    .filter((locale) => locale.code !== "en")
    .flatMap((locale) =>
      (Object.entries(CORE_PAGE_PATHS.en) as [CorePageKey, string][]).map(([pageKey, slug]) => {
        const canonicalPath = slug ? `/${slug}` : "/";
        return {
          url: `${BASE_URL}${localizedCorePath(pageKey, locale.code)}`,
          alternates: { languages: getHreflangLanguagesMap(canonicalPath) },
        };
      })
    );

  return [...englishEntries, ...localizedEntries];
}
