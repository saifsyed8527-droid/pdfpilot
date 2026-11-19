import { isRetiredResourcePath } from "./retired-routes";
import resourcePages from "../i18n/resource-pages.json";
import searchHolds from "../content/search-holds.json";
import { isLocaleIndexable } from "@/lib/i18n/indexable-locales";
import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";
import { CATEGORIES } from "@/lib/content/categories";
import { CORE_PAGE_PATHS, type CorePageKey } from "@/lib/i18n/core-content";
import { getActiveLocales } from "@/lib/i18n/locales";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { localizedPath } from "@/lib/i18n/url-strategy";

const BASE_URL = "https://pdfpilot.net";

// Pages that aren't part of the Tool or content models (home + static utility pages).
const NON_TOOL_PAGES = ["/about", "/privacy", "/terms"];

export function getIndexEntries(): MetadataRoute.Sitemap {
  const routes = [
    "",
    ...TOOLS.map((tool) => tool.path),
    ...NON_TOOL_PAGES,
    "/categories",
    ...CATEGORIES.map((category) => category.path),
  ];

  const coreByEnglishPath = new Map(
    (Object.entries(CORE_PAGE_PATHS.en) as [CorePageKey, string][]).map(([key, slug]) => [slug ? `/${slug}` : "/", key])
  );

  const englishEntries: MetadataRoute.Sitemap = [...new Set([...routes, ...Object.keys(resourcePages)])].filter(route => !isRetiredResourcePath(route) && !Object.hasOwn(searchHolds, route)).map((route) => {
    const path = route || "/";
    const pageKey = coreByEnglishPath.get(path);
    return {
      url: `${BASE_URL}${path}`,
      ...(pageKey || TOOLS.some(tool => tool.path === path) || Object.hasOwn(resourcePages, path) ? { alternates: { languages: getHreflangLanguagesMap(path) } } : {}),
    };
  });

  const localizedEntries: MetadataRoute.Sitemap = getActiveLocales()
    .filter(locale => locale.code !== "en")
    .flatMap(locale => ["/", ...TOOLS.map(tool => tool.path), ...Object.keys(resourcePages)]
      .filter(path => !isRetiredResourcePath(path) && isLocaleIndexable(path, locale.code) && !Object.hasOwn(searchHolds, path))
      .map(path => ({
        url: BASE_URL + localizedPath(path, locale.code),
        alternates: { languages: getHreflangLanguagesMap(path) },
      })));
  return [...englishEntries, ...localizedEntries];
}
