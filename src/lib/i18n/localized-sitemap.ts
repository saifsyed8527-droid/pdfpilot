/**
 * Localized sitemap architecture — ready-to-adopt, not wired into the live
 * src/app/sitemap.ts (SEO Architecture is frozen this sprint, and with one
 * active locale, calling this produces exactly the same URL set the
 * current sitemap already emits — there's nothing to change yet).
 *
 * When a second locale goes active, Phase 3's sitemap.ts changes from
 * `routes.map((route) => ({ url: BASE_URL + route, ... }))` to calling
 * `expandRoutesForActiveLocales(routes)` instead — the route-collecting
 * logic in sitemap.ts (every tool, guide, category, etc.) doesn't change
 * at all, only the final URL-expansion step.
 */

import { getActiveLocales } from "./locales";
import { localizedPath } from "./url-strategy";
import { getHreflangLanguagesMap } from "./hreflang";

export interface LocalizedSitemapEntry {
  url: string;
  /** Per Google's sitemap hreflang extension — lets a single sitemap
   *  declare language alternates inline instead of requiring a separate
   *  sitemap per locale. Next.js's `MetadataRoute.Sitemap` type supports
   *  this via the same `alternates.languages` shape used in page
   *  metadata. */
  alternates: { languages: Record<string, string> };
}

/** Expands a list of canonical (unprefixed, English) paths into one sitemap
 *  entry per active locale, each carrying the full hreflang alternate set. */
export function expandRoutesForActiveLocales(canonicalPaths: string[]): LocalizedSitemapEntry[] {
  const BASE_URL = "https://pdfpilot.net";
  const entries: LocalizedSitemapEntry[] = [];

  for (const path of canonicalPaths) {
    const languages = getHreflangLanguagesMap(path);
    for (const locale of getActiveLocales()) {
      entries.push({
        url: `${BASE_URL}${localizedPath(path, locale.code)}`,
        alternates: { languages },
      });
    }
  }

  return entries;
}
