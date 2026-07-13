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

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));
}
