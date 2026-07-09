import { TOOLS } from "./tools";
import { GUIDES } from "./content/guides";
import { CATEGORIES } from "./content/categories";
import type { SearchEntry } from "./search";

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
  ...GUIDES.map((guide) => ({
    type: "guide" as const,
    name: guide.title,
    description: guide.description,
    path: guide.path,
    haystack: `${guide.title} ${guide.description}`.toLowerCase(),
  })),
  ...CATEGORIES.map((category) => ({
    type: "category" as const,
    name: category.title,
    description: category.description,
    path: category.path,
    haystack: `${category.title} ${category.description}`.toLowerCase(),
  })),
].map((entry) => ({ ...entry, haystack: entry.haystack.toLowerCase() }));
