/**
 * hreflang generation — tells search engines which URL serves which
 * language, so they show the right locale's page in each region's search
 * results and don't treat locale variants as duplicate content.
 *
 * Real and correct against the current one-active-locale state: calling
 * this today for any tool returns a single "en" alternate plus an
 * "x-default" pointing at the same unprefixed URL — which is exactly the
 * right hreflang output for a site that only has one language. It doesn't
 * need to change shape when a second locale goes active; it already loops
 * over `getActiveLocales()`, not a hardcoded list.
 */

import { getActiveLocales, DEFAULT_LOCALE } from "./locales";
import { localizedPath } from "./url-strategy";

export interface HreflangAlternate {
  hreflang: string;
  href: string;
}

const BASE_URL = "https://pdfpilot.net";

/** Builds the full set of hreflang alternates for a canonical (unprefixed,
 *  English) path, including the required "x-default" entry pointing at
 *  the default-locale URL — the signal search engines use when a visitor's
 *  language doesn't match any listed alternate. */
export function getHreflangAlternates(canonicalPath: string): HreflangAlternate[] {
  const alternates = getActiveLocales().map((locale) => ({
    hreflang: locale.code,
    href: `${BASE_URL}${localizedPath(canonicalPath, locale.code)}`,
  }));

  alternates.push({
    hreflang: "x-default",
    href: `${BASE_URL}${localizedPath(canonicalPath, DEFAULT_LOCALE)}`,
  });

  return alternates;
}

/** Shaped to drop directly into Next.js Metadata's `alternates.languages`
 *  field once a page actually wants to emit it — e.g.
 *  `alternates: { canonical: path, languages: getHreflangLanguagesMap(path) } `.
 *  Kept as a separate export from getHreflangAlternates (rather than
 *  making callers reshape the array themselves) since Next's expected
 *  shape (a hreflang -> URL record) is different from the array shape
 *  that's more natural for hand-writing <link> tags outside Next's
 *  metadata API. */
export function getHreflangLanguagesMap(canonicalPath: string): Record<string, string> {
  return Object.fromEntries(
    getHreflangAlternates(canonicalPath).map(({ hreflang, href }) => [hreflang, href])
  );
}
