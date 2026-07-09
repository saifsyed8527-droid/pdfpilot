/**
 * Client-safe search types and matching logic. Deliberately contains NO
 * imports of the underlying data modules — the index itself is built
 * server-side in search-index.ts and handed to client components as props,
 * so entity payloads (e.g. Guide bodies) never enter the client bundle.
 */

export type SearchResultType = "tool" | "guide" | "category";

export interface SearchEntry {
  type: SearchResultType;
  /** Display name shown in results. */
  name: string;
  /** One-line supporting text shown under the name. */
  description: string;
  path: string;
  /** Lowercased searchable text — name + description + any extra keywords. */
  haystack: string;
}

export interface GroupedSearchResults {
  tools: SearchEntry[];
  guides: SearchEntry[];
  categories: SearchEntry[];
  total: number;
}

export function searchAll(index: readonly SearchEntry[], query: string): GroupedSearchResults {
  const q = query.trim().toLowerCase();
  const matches = q ? index.filter((entry) => entry.haystack.includes(q)) : [];
  const tools = matches.filter((m) => m.type === "tool");
  const guides = matches.filter((m) => m.type === "guide");
  const categories = matches.filter((m) => m.type === "category");
  return { tools, guides, categories, total: matches.length };
}
