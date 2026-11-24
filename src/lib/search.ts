/**
 * Client-safe search types and matching logic. Deliberately contains NO
 * imports of the underlying data modules — the index itself is built
 * server-side in search-index.ts and handed to client components as props,
 * so entity payloads (e.g. Guide bodies) never enter the client bundle.
 *
 * Matching runs in three passes, cheapest first, stopping as soon as one
 * produces results — most queries are a plain substring match (unchanged,
 * instant), so synonym expansion and fuzzy matching only ever run on
 * queries that need them:
 *   1. Substring match on the raw query (as before).
 *   2. Substring match on synonym-expanded terms (e.g. "combine" also
 *      searches "merge") — catches real vocabulary mismatches a substring
 *      search alone can't.
 *   3. Fuzzy match (bounded edit distance) against words in each entry's
 *      haystack — catches typos ("mrege") without matching unrelated short
 *      words, since the allowed distance scales with word length.
 * No new dependency: a small edit-distance function is enough for an index
 * of this size (tens of entries today, hundreds even at 300+ tools) and
 * keeps search entirely synchronous and instant.
 *
 * Whichever pass produces matches, results are then ranked by how directly
 * the entry's own name answers the query (exact name > name starts with
 * query > name contains query > matched some other way) — so "Merge PDF"
 * searching "merge" always outranks a guide that merely mentions merging
 * in its description, regardless of which pass found it.
 */

export type SearchResultType = "tool" | "guide" | "category" | "template" | "workflow";

export interface SearchEntry {
  type: SearchResultType;
  /** Display name shown in results. */
  name: string;
  /** One-line supporting text shown under the name. */
  description: string;
  path: string;
  /** Canonical tool slug, when its localized path uses a translated segment. */
  toolSlug?: string;
  /** Lowercased searchable text — name + description + any extra keywords. */
  haystack: string;
}

export interface GroupedSearchResults {
  tools: SearchEntry[];
  guides: SearchEntry[];
  categories: SearchEntry[];
  templates: SearchEntry[];
  workflows: SearchEntry[];
  total: number;
}

/**
 * Maps a query term to real vocabulary already in the index. Deliberately
 * one-directional and small: each entry is a term a user might realistically
 * type that doesn't literally appear in any tool/guide/category text today.
 * Adding a tool never requires touching this map — it's about bridging
 * *user* vocabulary, not indexing new content.
 */
const SYNONYMS: Record<string, string[]> = {
  combine: ["merge"],
  join: ["merge"],
  shrink: ["compress"],
  reduce: ["compress"],
  smaller: ["compress"],
  picture: ["image", "jpg"],
  photo: ["image", "jpg"],
  pic: ["image", "jpg"],
  doc: ["word"],
  docx: ["word"],
  pptx: ["powerpoint"],
  ppt: ["powerpoint"],
  slides: ["powerpoint"],
  slideshow: ["powerpoint"],
  spreadsheet: ["excel"],
  turn: ["rotate"],
  spin: ["rotate"],
  remove: ["delete", "extract"],
  erase: ["delete"],
  copy: ["duplicate"],
  clone: ["duplicate"],
  scan: ["ocr"],
  scanned: ["ocr"],
  handwriting: ["ocr"],
  dedupe: ["duplicate"],
  yml: ["yaml"],
  config: ["yaml"],
  api: ["json"],
  database: ["sql"],
  db: ["sql"],
  b64: ["base64"],
  uri: ["url"],
  table: ["csv", "excel"],
  xlsx: ["excel"],
  xls: ["excel"],
};

function expandWithSynonyms(query: string): string[] {
  const expansions = Object.hasOwn(SYNONYMS, query) ? SYNONYMS[query] : undefined;
  return expansions ? [query, ...expansions] : [query];
}

/** Bounded Levenshtein distance — returns early past `max` since callers
 *  only care whether the distance is within a small threshold, not the
 *  exact value. */
function editDistanceWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const currentRow = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previousRow[j] + 1,
        currentRow[j - 1] + 1,
        previousRow[j - 1] + cost
      );
      currentRow.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return false;
    previousRow = currentRow;
  }
  return previousRow[b.length] <= max;
}

/** Typo-tolerant distance budget: short words tolerate fewer errors than
 *  long ones, so "pdf" (3 letters) doesn't fuzzy-match half the alphabet. */
function maxEditDistanceFor(wordLength: number): number {
  if (wordLength <= 4) return 1;
  if (wordLength <= 8) return 2;
  return 3;
}

function fuzzyMatches(entry: SearchEntry, query: string): boolean {
  const words = entry.haystack.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const max = maxEditDistanceFor(query.length);
  return words.some((word) => editDistanceWithin(word, query, max));
}

/** Ranks a match by how directly it answers the query — an exact or
 *  near-exact name match ("Merge PDF" for "merge pdf") is almost always
 *  what the user wants over an entry that merely mentions the query
 *  somewhere in its description. Lower is more relevant, matching
 *  Array.sort's convention directly rather than inverting a "score". */
function relevanceRank(entry: SearchEntry, query: string): number {
  const name = entry.name.toLowerCase();
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  return 3; // matched via description/keywords, synonym, or fuzzy — name itself didn't match
}

function sortByRelevance(matches: SearchEntry[], query: string): SearchEntry[] {
  return [...matches].sort((a, b) => relevanceRank(a, query) - relevanceRank(b, query));
}

export function searchAll(index: readonly SearchEntry[], query: string): GroupedSearchResults {
  const q = query.trim().toLowerCase();

  let matches: SearchEntry[] = [];
  if (q) {
    matches = index.filter((entry) => entry.haystack.includes(q));

    if (matches.length === 0) {
      const terms = expandWithSynonyms(q);
      matches = index.filter((entry) => terms.some((term) => entry.haystack.includes(term)));
    }

    if (matches.length === 0 && q.length >= 3) {
      matches = index.filter((entry) => fuzzyMatches(entry, q));
    }

    matches = sortByRelevance(matches, q);
  }

  const tools = matches.filter((m) => m.type === "tool");
  const guides = matches.filter((m) => m.type === "guide");
  const categories = matches.filter((m) => m.type === "category");
  const templates = matches.filter(m => m.type === "template");
  const workflows = matches.filter(m => m.type === "workflow");
  return { tools, guides, categories, templates, workflows, total: matches.length };
}

// Action suggestions are separate from the generic index and from category browsing.
const RELATED_TOOL_SLUGS: Record<string, readonly string[]> = {
  "merge-pdf": ["split-pdf", "organize-pdf", "compress-pdf"],
  "compress-pdf": ["merge-pdf", "split-pdf", "repair-pdf"],
  "split-pdf": ["extract-pages", "delete-pages", "merge-pdf"],
};

const normalizeToolQuery = (value: string) => value
  .normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\bpdfs\b/g, "pdf");

/** Up to four direct tool destinations. Category, guide and resource records
 * cannot mask a better tool match or appear in the displayed suggestions. */
export function searchToolSuggestions(index: readonly SearchEntry[], query: string): SearchEntry[] {
  const q = normalizeToolQuery(query);
  if (!q) return [];

  const tools = [...new Map(index.filter((entry) => entry.type === "tool").map((entry) => [entry.path, entry])).values()];
  const terms = q.split(" ");
  const synonyms = terms.map((term) => expandWithSynonyms(term));
  const containsTerms = (value: string) => synonyms.every((choices) => choices.some((term) => value.includes(term)));
  const ranked = tools.map((entry) => {
    const name = normalizeToolQuery(entry.name);
    const haystack = normalizeToolQuery(entry.haystack);
    const rank = name === q ? 0
      : name.startsWith(q) ? 1
      : name.includes(q) ? 2
      : containsTerms(name) ? 3
      : haystack.includes(q) ? 4
      : containsTerms(haystack) ? 5 : 6;
    return { entry, name, rank };
  });

  let matches = ranked.filter(({ rank }) => rank < 6).sort((a, b) => a.rank - b.rank);
  if (matches.length === 0 && terms.length === 1 && q.length >= 4) {
    matches = ranked.filter(({ name }) => name.split(" ").some((word) => (
      word.length >= 4 && editDistanceWithin(word, q, Math.min(2, maxEditDistanceFor(q.length)))
    )));
  }
  if (matches.length === 0) return [];

  const suggestions = new Map<string, SearchEntry>();
  const add = (entry: SearchEntry) => suggestions.set(entry.path, entry);
  add(matches[0].entry);
  const slug = (entry: SearchEntry) => entry.toolSlug ?? entry.path.split("/").filter(Boolean).at(-1) ?? "";
  const key = slug(matches[0].entry);
  const related = Object.hasOwn(RELATED_TOOL_SLUGS, key) ? RELATED_TOOL_SLUGS[key] : undefined;
  if (matches[0].rank <= 3 && related) {
    // If two truly direct names match, keep both ahead of related suggestions.
    matches.filter(({ rank }) => rank <= 3).slice(1).forEach(({ entry }) => add(entry));
    const bySlug = new Map(tools.map((entry) => [slug(entry), entry]));
    for (const item of related) {
      const entry = bySlug.get(item);
      if (entry) add(entry);
    }
  }
  matches.forEach(({ entry }) => add(entry));
  return [...suggestions.values()].slice(0, 4);
}
