import { PUBLISHED_PDF_INTENTS } from "./content/pdf-intents";
import { TOOLS } from "./tools";
import type { SearchEntry } from "./search";
import { DOCUMENT_TEMPLATES, documentTemplatePath } from "./content/document-templates";
import { CONVERSION_TEMPLATES } from "./content/conversion-templates";
import { PDF_WORKFLOWS, workflowPath } from "./content/pdf-workflows";

/**
 * The universal search index, derived once from the same sources everything
 * else reads (Tool registry, Guide entities, Category entities) — the same
 * derivation pattern as tool-navigation.ts, not a new data store. Adding a
 * future searchable type (Help/FAQ entries, use cases) is one more
 * `...X.map(...)` line here; no component changes.
 *
 * Server-side only by design: page.tsx passes the resulting slim entries to
 * the client as props (see src/lib/search.ts for why).
 */
export const SEARCH_INDEX: readonly SearchEntry[] = [
  ...TOOLS.map((tool) => ({
    type: "tool" as const,
    name: tool.name,
    description: tool.tagline,
    path: tool.path,
    haystack:
      `${tool.name} ${tool.title} ${tool.description} ${tool.tagline} ` +
      `${tool.category} ${tool.group} ${tool.navCategory}`.toLowerCase(),
  })),
  ...PUBLISHED_PDF_INTENTS.filter(page => page.family !== "tool").map(page => ({ type: page.family === "guide" ? "guide" as const : "workflow" as const, name: page.title, description: page.description, path: page.path, haystack: `${page.title} ${page.description} ${page.intro}` })),
  ...DOCUMENT_TEMPLATES.map(row => ({ type: "template" as const, name: `${row.name} template`, description: row.description, path: documentTemplatePath(row), haystack: `${row.name} template pdf ${row.category} ${row.description}` })),
  ...CONVERSION_TEMPLATES.map(row => ({ type: "template" as const, name: row.title, description: row.description, path: row.path, haystack: `${row.title} ${row.description} ${row.tags.join(" ")}` })),
  ...PDF_WORKFLOWS.map(row => ({ type: "workflow" as const, name: row.title, description: row.description, path: workflowPath(row), haystack: `${row.title} ${row.description}` })),
].map((entry) => ({ ...entry, haystack: entry.haystack.toLowerCase() }));
