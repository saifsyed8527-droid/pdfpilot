/**
 * Recent Searches — real, client-side (localStorage), honest. Not
 * "popular searches": that would need real aggregated usage data, which
 * doesn't exist until Analytics (Phase 3's own instrumentation-only scope)
 * is actually collecting it — building a "popular searches" list today
 * would mean fabricating numbers, which this project doesn't do. Recent
 * searches needs no aggregate data at all, just this browser's own history,
 * so it's honest to ship now.
 */

const STORAGE_KEY = "pdfpilot:recent-searches";
const MAX_ENTRIES = 5;

function readRaw(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    // Corrupted or inaccessible storage (private browsing, quota, manual
    // tampering) degrades to "no history" rather than throwing — recent
    // searches is a convenience feature, never a hard dependency.
    return [];
  }
}

export function getRecentSearches(): string[] {
  return readRaw();
}

/** Records a search the user actually acted on. Case-insensitive
 *  deduplication (so "Merge" and "merge" collapse to one entry, most
 *  recent casing wins), newest first, capped at 5. */
export function recordSearch(query: string): void {
  if (typeof window === "undefined") return;
  const trimmed = query.trim();
  if (!trimmed) return;

  const existing = readRaw().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...existing].slice(0, MAX_ENTRIES);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable — silently skip persisting; searching
    // itself must never fail because history couldn't be saved.
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage is already inaccessible.
  }
}
