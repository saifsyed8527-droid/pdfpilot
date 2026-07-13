# Registry architecture reference — Phase 2C

Frozen since Phase 1; this doc documents what already exists, it does not
propose changes. Verified against the live codebase during the Phase 2C
registry audit (2026-07-13): 35 tools in `tools-data.json`, 35 matching
route directories under `src/app/`, zero orphans in either direction.

## Source of truth

`src/lib/tools-data.json` — hand-edited, one object per tool. Loaded and
typed by `src/lib/tools.ts` into the `TOOLS` array. Every other file that
needs tool data imports `TOOLS` from there; nothing reads
`tools-data.json` directly a second time.

### `Tool` fields and what each one drives

| Field | Drives |
|---|---|
| `id` | Stable cross-reference key (`"tool-{slug}"`) used by `categories.ts`'s `contains` lists and other content registries — never used for routing. |
| `slug` | Bare identifier (`"merge-pdf"`); must match both the route folder name and the OG image filename. |
| `path` | The real, public URL. Source of truth for routing — never derived from `slug` at render time, so it can't silently drift. |
| `domain` | Document-type family (`"pdf"` today for all 35). Present now so a future non-PDF domain needs no schema migration. |
| `category` | One of 4 values (`organize`/`optimize`/`convert`/`edit`) — the broad taxonomy that actually drives the mega menu's grouping, via `tool-navigation.ts`. Distinct from the SEO category *hub pages* in `categories.ts`, which are a separate, hand-curated concept (see below). |
| `group` | Homepage section heading (e.g. "Core PDF", "Page Management"). |
| `navCategory` | Mega menu's top-level tab (e.g. "PDF Tools", "Image Tools"). |
| `order` | Explicit sort order across nav/footer/home — independent of array position in the JSON file. |
| `name` | Short display name — nav label, footer link text, OG image title, homepage card title, JSON-LD `name`. |

(Additional SEO-specific fields — title tag, description, FAQs — exist per
tool but are consumed by each tool's own `page.tsx`, not by the
cross-cutting consumers listed below.)

## Consumers (verified this sprint, all import `TOOLS` directly)

- **`tool-navigation.ts`** — computes the nav/mega-menu group structure
  once from `TOOLS`, grouped by `navCategory` → `category`. Consumed by
  `navbar.tsx` via `getToolNavigation()`; `navbar.tsx` itself never
  imports `TOOLS`.
- **`footer.tsx`** — popular tools list, category links.
- **`home-client.tsx`** — homepage tool grid, grouped by `group`.
- **`sitemap.ts`** — every tool's `path` becomes a sitemap entry.
- **`search-index.ts`** — every tool becomes a searchable entry.
- **Every tool's own `page.tsx`** (all 35, verified) — looks up its own
  entry by slug for metadata, JSON-LD, and canonical URL, rather than
  hardcoding any of those.
- **`registry.ts`** — resolves `{type: "tool", id: "tool-{slug}"}`
  references from content registries (categories, guides, etc.) into
  real `Tool` objects for "Related Content" sections.
- **`seo/tool-registry.ts`** — per-tool SEO helper functions.
- **`scripts/generate-assets.js`** — reads `tools-data.json` directly
  (the one legitimate second reader, since it runs at build/asset-gen
  time, outside the TypeScript module graph) to generate one OG image and
  favicon set per tool. Verified this sprint: all 35 tools have a
  matching `/public/og/{slug}.png`.

## Category hub pages are curation, not an index

`src/lib/content/categories.ts` defines a small number of SEO landing
pages (7, as of this sprint), each with a hand-picked `contains` list of
tightly related tools/guides/help/comparisons — e.g. the "Merge PDF Tools"
hub links the Merge PDF tool plus 3 specifically relevant guides/help
articles, not every tool in the `organize` taxonomy group. Verified this
sprint: 15 of the 35 tools appear in at least one hub's `contains` list,
and every `{type: "tool", id: "..."}` reference resolves to a real tool
(zero orphaned references). This is expected — hub pages are curated
topical clusters for SEO, not a mechanical listing, and the mega
menu/footer/sitemap/search already provide complete, registry-driven
coverage of all 35 tools independent of hub curation.

## Adding a 36th tool (unchanged process, documented for Phase 3 planning)

1. Add one entry to `tools-data.json`.
2. Create `src/app/{slug}/page.tsx` + `{slug}-client.tsx`.
3. Run `node scripts/generate-assets.js`.
4. Optionally add the tool to a relevant category hub's `contains` list —
   optional because every other surface already picks it up automatically.

No file in the list above needs a manual edit for step 1–3 to reach every
consumer.
