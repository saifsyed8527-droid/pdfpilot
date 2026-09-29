/** Reciprocal alternates include only locales whose main content passed the shared indexability policy. */

import { isLocaleIndexable } from "./indexable-locales";
import { getActiveLocales, DEFAULT_LOCALE } from "./locales";
import { localizedPath } from "./url-strategy";

export interface HreflangAlternate {
  hreflang: string;
  href: string;
}

const BASE_URL = "https://pdfpilot.net";

/** Builds the full set of hreflang alternates for a canonical (unprefixed,
 *  English) path, including an "x-default" entry pointing at
 *  the default-locale URL — the signal search engines use when a visitor's
 *  language doesn't match any listed alternate. */
export function getHreflangAlternates(canonicalPath: string): HreflangAlternate[] {
  const alternates: HreflangAlternate[] = getActiveLocales().filter(locale => isLocaleIndexable(canonicalPath, locale.code)).map((locale) => ({
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
