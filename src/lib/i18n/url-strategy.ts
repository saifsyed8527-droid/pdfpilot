/**
 * URL Strategy — subdirectory locale prefixing (`/fr/merge-pdf`), with the
 * default locale (English) served unprefixed at the existing root URLs
 * (`/merge-pdf`, not `/en/merge-pdf`).
 *
 * Why subdirectories, not subdomains or ccTLDs (decided now, documented so
 * Phase 3 doesn't have to re-litigate it):
 * - Subdomains (fr.pdfpilot.net) and ccTLDs (pdfpilot.fr) split Google's
 *   authority signal across separate hostnames — each would need to earn
 *   backlinks and ranking independently. A subdirectory inherits the
 *   root domain's existing authority immediately, which matters a lot for
 *   a site relying on organic search as its primary channel.
 * - Subdirectories are a single Next.js deployment (one build, one
 *   hosting target) — subdomains/ccTLDs would mean either multiple
 *   deployments or DNS/routing complexity this project has no
 *   operational need for.
 * - This is Google's own documented recommendation when there's no strong
 *   reason to do otherwise (e.g. a legal requirement for a local ccTLD),
 *   and it's what the majority of large sites that localize well actually
 *   use.
 *
 * Why the default locale stays unprefixed:
 * Every tool URL PDFPilot has already indexed, linked internally, and
 * (per the Phase 1/2 SEO architecture) built canonical/OG/JSON-LD around
 * is unprefixed (`/merge-pdf`). Introducing a mandatory `/en/` prefix for
 * the existing, dominant-traffic locale would mean 301-redirecting every
 * existing URL — a real, avoidable SEO risk (temporary ranking loss during
 * reindexing) for zero benefit, since English isn't "one of several
 * languages" today, it's the entire site. New locales are additive
 * (`/fr/*`, `/de/*`); nothing about the existing site's URLs changes when
 * they're added.
 */

import { DEFAULT_LOCALE, isValidLocale } from "./locales";

/** Builds the localized URL for a given canonical (unprefixed, English)
 *  path and locale. `path` must start with "/". */
export function localizedPath(path: string, locale: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  return `/${locale}${path}`;
}

/** The inverse of localizedPath — given a real request pathname, splits
 *  off a valid locale prefix if present. Returns the default locale and
 *  the path unchanged when no recognized prefix is found (covers both "no
 *  prefix = English" and "unrecognized segment, not actually a locale
 *  prefix, don't misinterpret it as one"). This is what a future
 *  `[locale]` route segment's layout would call to resolve which locale a
 *  request is for. */
export function parseLocalizedPath(pathname: string): { locale: string; path: string } {
  const match = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  if (match && isValidLocale(match[1])) {
    return { locale: match[1], path: match[2] || "/" };
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}
