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
};

function expandWithSynonyms(query: string): string[] {
  const expansions = SYNONYMS[query];
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
  }

  const tools = matches.filter((m) => m.type === "tool");
  const guides = matches.filter((m) => m.type === "guide");
  const categories = matches.filter((m) => m.type === "category");
  return { tools, guides, categories, total: matches.length };
}
