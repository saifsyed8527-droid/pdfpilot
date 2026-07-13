# Platform architecture overview — Phase 2C

Written as the entry point into PDFPilot's architecture docs. Each section
links to a deeper doc rather than repeating it — this file is the map, not
the territory.

## Layers

```
tools-data.json          <- single source of truth, hand-edited
      |
      v
tools.ts (TOOLS array)   <- typed, validated, icon-mapped
      |
      +--> navbar.tsx (via tool-navigation.ts) -- mega menu
      +--> footer.tsx                          -- popular tools, categories
      +--> home-client.tsx                     -- homepage tool grid
      +--> sitemap.ts                          -- XML sitemap
      +--> search-index.ts                     -- search
      +--> each tool's page.tsx                -- metadata, JSON-LD, canonical
      +--> registry.ts                         -- related-content resolution
      +--> seo/tool-registry.ts                -- per-tool SEO helpers
      +--> scripts/generate-assets.js          -- OG images, favicons
```

One JSON file drives eleven consumers. Adding a tool means adding one
`tools-data.json` entry, creating `src/app/{slug}/page.tsx` +
`{slug}-client.tsx`, and re-running `generate-assets.js` — every other
surface (§ Registry audit, verified this sprint: 35/35 tools present in
every consumer, zero orphans either direction) updates automatically. See
[registry-architecture.md](registry-architecture.md) for the full field-by-
field reference.

## Engine layer

Tool pages never call a third-party library directly — they call a
function in `src/lib/engines/*.ts`, which wraps the library. This is what
makes "every tool must reuse the Engine Layer" (Phase 2B rule #6) checkable
rather than aspirational: a new tool that hand-rolls its own pdf-lib call
instead of importing from `pdf-engine.ts` is visibly doing something
different from every other tool in a code review. Full engine-by-engine
reference: [engine-architecture.md](engine-architecture.md).

## Content system (frozen, Phase 1)

Guides, help articles, comparisons, use-cases, and categories are separate
hand-authored registries (`src/lib/content/*.ts`), resolved into
`ResolvedEntity` objects by `registry.ts` and rendered by
`ToolRelatedContent`. Category hub pages (`categories.ts`) hand-curate a
`contains: [{type, id}]` list of tightly related entities — this is
deliberate editorial curation for topical SEO clusters, not an index of
every tool (verified this sprint: 15 of 35 tools appear in a curated
category hub `contains` list; all 35 carry their own `category` field for
the broader 4-value taxonomy — `organize`/`optimize`/`convert`/`edit` — that
actually drives the mega menu). Not modified this sprint per the Phase 1
freeze.

## i18n (architecture only, not activated)

`src/lib/i18n/*` + `language-switcher.tsx` — real, working code, not wired
into any live page. Full detail: [phase-2b-i18n-architecture.md](phase-2b-i18n-architecture.md).

## Security & AI (architecture only, not activated)

`security-engine.ts` / `ai-engine.ts` define the real interfaces every
tool will call once a server exists; every function currently throws a
typed, descriptive error rather than silently no-opping. Full server plan:
[phase-2-server-architecture.md](phase-2-server-architecture.md). Consolidated
list of every deferred capability across the whole platform (not just
Security/AI): [deferred-features.md](deferred-features.md).

## What Phase 2C changed here

Nothing in this section list — Phase 2C is a stabilization pass
(bug fixes, dead-code removal, documentation, verification), not an
architecture change. The one production bug found and fixed this sprint
(Excel/PowerPoint to PDF silently dropping all table content) was fixed
inside the existing Engine Layer boundary (`office-engine.ts` +
`text-engine.ts`), not by adding a new layer — see
[engine-architecture.md](engine-architecture.md#office-engine) for the
specifics.
