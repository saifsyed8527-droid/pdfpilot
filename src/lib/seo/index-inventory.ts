import resourcePages from "../i18n/resource-pages.json";
import { TASK_TEMPLATES, TASK_ROOT, taskPath } from "@/lib/content/task-templates";
import { DATA_WORKFLOWS, dataWorkflowPath } from "@/lib/content/data-workflows";
import searchHolds from "../content/search-holds.json";
import { isLocaleIndexable } from "@/lib/i18n/indexable-locales";
import type { MetadataRoute } from "next";
import { DOCUMENT_CATEGORIES } from "@/lib/content/document-templates";
import { PDF_WORKFLOWS, workflowPath } from "@/lib/content/pdf-workflows";
import { CONVERSION_TEMPLATES, TEMPLATE_ROOT, TEMPLATE_TOOLS } from "@/lib/content/conversion-templates";
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
import { localizedPath } from "@/lib/i18n/url-strategy";

const BASE_URL = "https://pdfpilot.net";

// Pages that aren't part of the Tool or content models (home + static utility pages).
const NON_TOOL_PAGES = ["/about", "/privacy", "/terms"];

export function getIndexEntries(): MetadataRoute.Sitemap {
  const routes = [
    "",
    ...TOOLS.map((tool) => tool.path),
    ...NON_TOOL_PAGES,
    "/guides",
    "/templates",
    ...Object.keys(DOCUMENT_CATEGORIES).map(category => `/templates/collections/${category}`),
    "/pdf-workflows",
    ...PDF_WORKFLOWS.map(workflowPath),
    ...DATA_WORKFLOWS.map(dataWorkflowPath),
    TASK_ROOT,
    ...TASK_TEMPLATES.map(taskPath),
    TEMPLATE_ROOT,
    ...TEMPLATE_TOOLS.map(tool => `${TEMPLATE_ROOT}/${tool}`),
    ...CONVERSION_TEMPLATES.map((page) => page.path),
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

  const englishEntries: MetadataRoute.Sitemap = [...new Set([...routes, ...Object.keys(resourcePages)])].filter(route => !Object.hasOwn(searchHolds, route)).map((route) => {
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
      .filter(path => isLocaleIndexable(path, locale.code) && !Object.hasOwn(searchHolds, path))
      .map(path => ({
        url: BASE_URL + localizedPath(path, locale.code),
        alternates: { languages: getHreflangLanguagesMap(path) },
      })));
  return [...englishEntries, ...localizedEntries];
}
