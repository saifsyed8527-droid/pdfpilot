/**
 * Localized metadata/canonical/sitemap/JSON-LD architecture — ready-to-
 * adopt utilities that extend this project's existing SEO helpers
 * (src/lib/seo/*, src/lib/content/seo.ts) with locale awareness, without
 * modifying any of them. None of these are called from any live page —
 * Phase 1/2's SEO architecture is frozen this sprint, and there's nothing
 * to localize yet (one active locale = current behavior is already
 * correct). This file is what Phase 3 imports once a second locale goes
 * active and a `[locale]` route segment exists.
 */

import type { Metadata } from "next";
import { getHreflangLanguagesMap } from "./hreflang";
import { localizedPath } from "./url-strategy";
import { DEFAULT_LOCALE, isValidLocale } from "./locales";

const BASE_URL = "https://pdfpilot.net";

/** Wraps any already-built Metadata object (e.g. the output of this
 *  project's existing `buildEntityMetadata`) with locale-correct canonical
 *  + hreflang alternates, for a given canonical (unprefixed) path and the
 *  locale actually being served. Doesn't reimplement title/description/OG
 *  generation — those stay exactly as every existing tool/content page
 *  already builds them; this only adds what's locale-specific. */
export function withLocaleAlternates(
  metadata: Metadata,
  canonicalPath: string,
  locale: string
): Metadata {
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      canonical: `${BASE_URL}${localizedPath(canonicalPath, locale)}`,
      languages: getHreflangLanguagesMap(canonicalPath),
    },
  };
}

/** The canonical URL a page's JSON-LD (Organization, SoftwareApplication,
 *  BreadcrumbList, etc.) should reference for a given locale — JSON-LD's
 *  `url`/`@id` fields need the same locale-correct URL as the page's own
 *  canonical, and every existing schema builder in src/lib/seo/*.ts
 *  already accepts a `path` string, so this is the one function Phase 3
 *  needs to compute the right `path` to pass into those unchanged
 *  builders — not a new schema-generation system. */
export function getLocalizedSchemaUrl(canonicalPath: string, locale: string): string {
  return `${BASE_URL}${localizedPath(canonicalPath, locale)}`;
}

/** Resolves which locale a request is actually for, defaulting safely to
 *  English for anything unrecognized — the one place route handlers
 *  (a future `[locale]/layout.tsx`) should call rather than trusting a
 *  raw route param. */
export function resolveLocale(localeParam: string | undefined): string {
  if (localeParam && isValidLocale(localeParam)) return localeParam;
  return DEFAULT_LOCALE;
}
