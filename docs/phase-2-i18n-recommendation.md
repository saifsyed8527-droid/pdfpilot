# i18n architecture recommendation

Research-and-recommend only, per Phase 2 instructions. **No code was changed
for this section** — PDFPilot has zero translated content today, and
standing up locale routing with nothing to route to would produce broken or
fake-translated pages, which the project's own rules explicitly forbid.
This document is the target architecture to build against once real
translations exist, not a partial implementation.

## Competitor research (verified live, not assumed)

| Competitor | URL pattern | Verified |
|---|---|---|
| iLovePDF | `ilovepdf.com/es` (path-based) | `curl -IL` → 200 |
| Smallpdf | `smallpdf.com/fr` (path-based) | `curl -IL` → 200 |
| Adobe (Acrobat Online) | `adobe.com/de/acrobat/...` (path-based, even under a product subdomain) | `curl -IL` → 200 |
| PDF24 | `tools.pdf24.org/de/` (path-based) | `curl -IL` → 200 |

All four independently converged on **path-based subdirectory locales**
(`/xx/...`), not subdomains (`xx.site.com`) and not ccTLDs (`site.fr`).
That's a strong, consistent signal — but per the instruction not to blindly
copy competitors, here's the independent reasoning for why it's also the
right call for PDFPilot specifically, not just "everyone else does it":

- **Domain authority stays unified.** A single `pdfpilot.net` accumulates
  backlinks and search authority across every locale. ccTLDs (`pdfpilot.fr`)
  or subdomains fragment that into separate properties Google treats more
  independently — a real SEO cost for a project whose whole growth strategy
  (per the Phase 1 architecture) is programmatic, registry-driven content
  scale.
- **Zero new infrastructure.** ccTLDs require buying and maintaining N
  domains; subdomains still need their own DNS/cert/hosting wiring in some
  setups. A path prefix needs none of that — it's a routing change.
- **Next.js App Router supports this natively** via a `[locale]` dynamic
  segment wrapping the existing route tree, with zero changes to the
  frozen Phase 1 architecture underneath it (registry, search, nav, SEO
  helpers all stay exactly as they are — only the URL gains a prefix and
  every generator gets a `locale` parameter).

## Recommended target architecture (for when translated content exists)

```
src/app/
  [locale]/
    layout.tsx          -- reads `locale` param, sets <html lang>
    page.tsx             -- homepage
    merge-pdf/page.tsx
    ... (every existing route, unchanged internally)
```

- **Locale prefix**: `/en/merge-pdf`, `/es/merge-pdf`, etc. English can
  either get an explicit `/en/` prefix (simplest, most consistent — every
  locale is treated identically, no special-cased "default locale has no
  prefix" branching) or be the unprefixed default (marginally better
  existing-URL preservation, at the cost of one more special case
  throughout the routing/canonical/sitemap logic). **Recommend explicit
  `/en/` for all locales, including English** — consistency over a minor
  URL aesthetic, and it avoids a redirect migration for the existing
  unprefixed URLs later.
- **`generateStaticParams`**: extend to iterate `locales × existing params`
  (e.g., guides' `generateStaticParams` becomes `locale × slug` instead of
  just `slug`) — the registry entities themselves would need a
  locale-keyed content field or a parallel translated-content structure;
  which of those is simpler is a decision for whoever does the actual
  translation work, not this architecture doc.
- **Canonical + hreflang**: every page emits `<link rel="canonical">` for
  its own locale (unchanged pattern, just locale-aware now) plus
  `<link rel="alternate" hreflang="es" href=".../es/...">` for every other
  locale that has a translation of that specific page — critically, **not
  every locale needs every page translated on day one**; hreflang only
  lists locales that actually exist for that URL, so partial rollout
  (e.g., translate the 10 highest-traffic tools first) doesn't produce
  broken hreflang references.
- **Sitemap**: `sitemap.ts` gains a locale loop around its existing route
  list — same derivation pattern, no new architecture.
- **JSON-LD / breadcrumbs / search**: all already resolve their strings
  from the registry/content entities; making those locale-aware is a data
  problem (translated strings need to exist somewhere) more than a
  structural one — the existing `getEntitySchema`/`buildEntityBreadcrumb`
  helpers don't need to change shape, just receive localized input.
- **Search**: the existing client-side `searchAll` logic is locale-agnostic
  by construction (it operates on whatever `SearchEntry[]` it's given) — a
  locale-specific search index is just "build `SEARCH_INDEX` from the
  translated entities for that locale" using the exact same
  `search-index.ts` derivation, called once per locale at build time.

## What NOT to do

- Don't auto-translate content with an LLM and ship it as if human-quality
  — that's the same "fake capability" problem this sprint's Security/AI
  sections explicitly ruled out, applied to content instead of code.
  Machine translation as a *starting draft* for human review is a
  reasonable production pipeline; auto-translated text presented directly
  to users as finished localized content is not.
- Don't implement locale routing before locale #2's content is ready to
  ship — an `/es/` prefix serving English content (or nothing) is worse
  than not having the prefix at all: it's an indexable, crawlable URL that
  looks broken to both users and Google.

## Recommendation

**Defer implementation.** Document the target architecture (above) now so
it's a known, agreed-upon plan — implement it as part of whichever future
sprint actually produces the first non-English translated content, at
which point this becomes an implementation task with a clear spec rather
than a design question blocking that work.
