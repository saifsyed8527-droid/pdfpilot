# i18n architecture — Phase 2B

Real, functional utilities under `src/lib/i18n/` plus one standalone
component (`src/components/language-switcher.tsx`), none of it wired into
any live page or frozen file (Navigation, Routing, SEO Architecture).
Written so Phase 3 can activate a real second locale as a content +
one-route-segment change, not an architecture project.

## What's implemented (real, tested against the live registry)

| File | Purpose |
|---|---|
| `src/lib/i18n/locales.ts` | Language registry — code, name, native name, direction, `active` flag. Today: only `en` is active. |
| `src/lib/i18n/url-strategy.ts` | Subdirectory locale prefixing (`localizedPath`/`parseLocalizedPath`), default locale unprefixed. |
| `src/lib/i18n/hreflang.ts` | `getHreflangAlternates` / `getHreflangLanguagesMap` — real hreflang generation, including the required `x-default` entry. |
| `src/lib/i18n/localized-metadata.ts` | `withLocaleAlternates` (wraps existing Metadata objects with locale-correct canonical + hreflang), `getLocalizedSchemaUrl` (for JSON-LD), `resolveLocale`. |
| `src/lib/i18n/localized-sitemap.ts` | `expandRoutesForActiveLocales` — verified against Next.js's real `SitemapFile` type (`alternates.languages`, confirmed in `node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts`). |
| `src/components/language-switcher.tsx` | Real dropdown, renders `null` when only one locale is active (correct behavior now, not a placeholder). |

Every function above was run against the actual current registry state
during this sprint — `getHreflangAlternates("/merge-pdf")` today correctly
returns exactly one alternate (`en`) plus `x-default`, both pointing at
`/merge-pdf`. That's the right output for a one-locale site, and it's the
same code path a two-locale site would use — nothing here is mocked or
stubbed pending "real" implementation.

## URL strategy decision (subdirectories, default locale unprefixed)

Documented in full in the doc comment at the top of `url-strategy.ts`.
Summary: subdirectories (`/fr/merge-pdf`) inherit the root domain's
existing search authority immediately, unlike subdomains or ccTLDs, which
split it across separate hostnames that each have to earn ranking
independently — a real cost for a site whose primary channel is organic
search. The current English URLs stay unprefixed rather than moving to
`/en/*`, because 301-redirecting every already-indexed tool URL for zero
benefit (English isn't "a language variant," it's the whole site today) is
an avoidable ranking risk.

## Translation loading strategy (recommendation, not implemented)

No translation library is installed and no translated content exists, so
there's nothing to load yet — writing a translation-loading module today
would mean stubbing an API against content that doesn't exist, which is
exactly the "don't fake it" rule this sprint set. The recommendation for
when real translated content exists:

**`next-intl`** — the standard, actively maintained i18n library for the
Next.js App Router (unlike `react-i18next`, which predates the App Router
and needs extra glue for Server Components). It integrates with exactly
the `[locale]` route-segment pattern `url-strategy.ts` already assumes,
supports static rendering per locale (important for this project's
all-static page generation), and its message-loading model (JSON per
locale, loaded per-route) matches the registry-driven pattern already used
everywhere else in this codebase — one JSON file per active locale, not a
new content system.

Do not implement this until real translated copy exists to load — an
empty or machine-translated placeholder set would violate the same
"never fake it" principle as everything else in this sprint.

## Automatic registry compatibility

Every existing registry (`TOOLS`, `CATEGORIES`, `GUIDES`, etc.) already
stores content in English with no locale field — this was a deliberate
non-change. Adding a locale means adding parallel translated content
files, not modifying the existing registries' shape. `localized-metadata.ts`
and `localized-sitemap.ts` are designed to layer locale-awareness on top
of whatever the existing registries already produce (a list of canonical
paths), not to require every registry to become locale-aware itself.

## What Phase 3 actually does to activate a locale

1. Add real translated content (translated tool names/descriptions/FAQs,
   translated guide content) — a content project, not a code project.
2. Flip that locale's `active: true` in `locales.ts`.
3. Add a `src/app/[locale]/` route segment wrapping the existing routes,
   using `resolveLocale()` to read the segment and the existing page
   components (unchanged) to render.
4. Import `LanguageSwitcher` into `navbar.tsx` — the one and only change
   to a currently-frozen file this whole plan requires, and it's additive
   (one new component in the nav), not a redesign.
5. Swap `sitemap.ts`'s route-to-URL mapping for `expandRoutesForActiveLocales`.

No changes to `hreflang.ts`, `url-strategy.ts`, `localized-metadata.ts`, or
`localized-sitemap.ts` at that point — they already handle N locales.
