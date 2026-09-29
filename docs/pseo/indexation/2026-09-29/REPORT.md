# Indexation diagnostic and tested local changes — 2026-09-29

**Technical implementation is complete locally. Production still serves commit `67682f5`; no push or deployment was performed. Google recrawling and indexing after these changes are unknown.**

## Deployed source of truth

At the start of the batch the checkout, GitHub `main` and Ready Vercel production deployment all matched `67682f58a7cded3a21cce4984d4900e753906986`. All ten approved English pSEO URLs returned live HTTP 200 with their expected canonicals. GitHub main was checked again at the end and still matched. Vercel production evidence is [deployment 2QawDxNeev3xZaxVKxCsfut9Gcgt](https://vercel.com/saifsyed8527-5966s-projects/pdfpilot/2QawDxNeev3xZaxVKxCsfut9Gcgt); the UI showed Ready, Production, `main`, and completion on September 29 at 13:18:47 IST.

Work continued in `/Users/apple/Documents/Claude/Projects/PDF Pilot/pseo-engine` on `codex/pseo-engine`. No new checkout was created. The 107 protected processing/client/worker/converter files remain byte-for-byte unchanged.

## What happened around September 19

The GSC chart rises from 185 on September 18 to 1,219 on September 19, a change of **1,034**. Its last supplied chart date is September 21; September 29 is the export date, not a newly observed September 29 crawl state. Metadata says **All known pages**, so the export does not identify the discovery channel.

Commit `eddeaea09f36829a4f4a319b106030bb43fc8755`, authored September 18, expanded the sitemap from 255 to 1,289 entries: **94 additional tool paths × 11 locales = 1,034**. The five previously translated core tools already had localized routes. Of the capped 1,000 GSC examples, **851 match these newly added paths**. Later September 19 locale/homepage changes continued broad discovery. On September 25, commit `5f05473` limited public tools to 26, with the other 73 registry tools returning 404 through middleware.

This is strong evidence that broad international URL expansion drove discovery volume. It is not proof that every example was found in a sitemap, nor proof of Google's reason for declining each URL. The historic Vercel artifact for `eddeaea` was verified as a Ready **Preview** deployment completed September 19 at 15:55:03 IST; the exact production promotion time is not established. One older historical snapshot (`2d346e3`) could not be reconstructed by the standalone loader and is recorded as an error rather than invented.

The ten new English pSEO owners are not present in the supplied excluded sample and were deployed later. There is no evidence here that they caused the September 19 jump.

## Every exported GSC example is classified

The file contains 1,000 examples, not all 1,219 affected URLs. **906 examples are locale-prefixed.** All `1970-01-01` Last Crawled values are stored as unavailable, with the original value retained. They are not treated as real Google crawl dates.

| Final classification | Examples |
|---|---:|
| E. Non-public / hidden tool | 705 |
| G. Thin or duplicate locale page | 178 |
| D. Valid localized page | 66 |
| C. Valid resource/content page | 22 |
| I. Comparison/resource page | 21 |
| A. Current approved core tool | 8 |
| B. Approved pSEO page | 0 |
| F. Legacy route | 0 |
| H. Unsupported tool, separately classified | 0 |
| J. Unknown | 0 |

The hidden-tool classification takes precedence over “unsupported”; it does not assert the underlying code was deleted or cannot work. Comparison/resource classifications include both retained resources and held operational pages; use `indexWanted` for the final decision.

**103 of the 1,000 examples are wanted now.** The other **897** are 705 existing 404s, 178 incomplete locale pages held with noindex and 14 held operational resource pages. The 219 unexported examples are unknown; there is no defensible exact wanted count for the full 1,219.

Before this change 295 sample URLs returned indexable content and appeared in the sitemap. Afterward 103 are wanted; 192 remain accessible but noindexed. The 705 hidden-tool 404s predate this batch.

See [all 1,000 classifications](gsc-classification.csv), [the canonical inventory](wanted-index-inventory.csv), and [the 99-tool registry audit](registry-99.csv). The inventory includes all currently generated canonical routes, known legacy routes, the exported examples and 50 locale aliases: 1,262 tested URLs. It cannot enumerate arbitrary query strings; representative query behavior is recorded separately.

## Current production versus tested local result

| Metric | Live baseline | Tested local result |
|---|---:|---:|
| Wanted sitemap entries under final policy | Not previously separated | 242 |
| Sitemap URLs | 472 | 242 |
| Canonical locale URLs eligible for indexing | 297 | 83 (81 core/home + 2 pSEO) |
| Generic locale wrappers held | 0 | 216 |
| Operational resource pages held | 0 | 16 |
| Confirmed self-canonical locale aliases | 50 | 0; direct 308 to established equivalents |
| Missing reciprocal hreflang URL pairs in sitemap population | 209 | 0 |
| Invalid/non-200/noindex/non-self-canonical sitemap entries | 0 | 0 |
| Sitemap pages without an observed internal source link | 0 | 0 |
| English core metadata/H1 coverage | 26/26 | 26/26, copy strengthened |
| Approved pSEO owners | 10 | 12 |
| Protected processing source files changed | — | 0/107 |
| GSC affected total | 1,219 in supplied chart | Not remeasured |

The baseline canonical sitemap was mechanically valid but included weak/incomplete search destinations. Quality eligibility, not merely XML validity, required the cleanup. The 50 additional aliases were outside the sitemap; live HTTP probes verified them as duplicates. Including those aliases, 522 known URLs were HTTP-indexable before, versus 242 after. A redirect is not counted as an indexable destination even though its final fetched page returns 200.

The after-crawl has 474 HTTP 200 pages (242 indexable, 232 noindexed), 736 existing 404s, 51 permanent redirects and one existing temporary redirect. The 51 permanent redirects comprise 50 new locale aliases plus the pre-existing `/workflows` redirect. `/remove-pages` keeps its existing one-hop 307 to `/delete-pages`. No homepage catch-all or mass 410 was introduced.

## Sitemap structure and technical eligibility

`/sitemap.xml` now directly lists URL sets, avoiding a nested sitemap-index hierarchy. The existing `/sitemaps/pseo.xml` remains available for compatibility. Robots permits crawling, including noindexed and unavailable URLs so crawlers can observe their state.

| Family | Canonical entries |
|---|---:|
| English core/home/legal/about | 30 |
| Portuguese core/home | 21 |
| Other reviewed locales | 60 |
| English pSEO | 10 |
| Portuguese pSEO | 2 |
| Resources | 69 |
| Workflows/templates | 50 |
| Total | 242 |

Every listed URL returned 200, was indexable, had a self-canonical, valid parsed structured data, and at least one observed internal source link. Hreflang targets are indexable and reciprocal. There are no observed indexable URLs outside the final wanted sitemap inventory. Hreflang and sitemap generation share the same locale policy.

Noindex pages remain self-canonical; they do not falsely canonicalize translated or different content to English. Exact locale aliases redirect to their established equivalent, such as `/pt-br/merge-pdf` → `/pt-br/juntar-pdf`. Tracking query variants canonicalize to the clean core URL; filtered workflow hubs are noindexed and canonicalize to their hub. Production review previews, unsupported target-size routes, and unapproved cross-language slugs return 404.

Sitemaps help discovery and communicate preferred URLs; they do not guarantee indexing. See [Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) and [crawling/indexing FAQ](https://developers.google.com/search/help/crawling-index-faq). No robots block, mass indexing request or unsupported crawler-budget tactic was introduced.

## Content pruning and link equity

All 135 previously sitemap-listed English resource/workflow/template/hub URLs have a proposed action. Their detailed reasoning and known hidden-tool references are in [content-pruning.csv](content-pruning.csv).

| Action | Count |
|---|---:|
| KEEP | 69 |
| IMPROVE | 38 |
| MERGE | 1 |
| NOINDEX | 16 |
| REMOVE | 0 |
| REDIRECT | 0 |
| REVIEW | 11 |

| Content family | Proposed action counts |
|---|---|
| resources | KEEP: 2 |
| category | IMPROVE: 8 |
| checklist | KEEP: 1, NOINDEX: 1 |
| comparison | KEEP: 5, MERGE: 1, NOINDEX: 5, REVIEW: 3 |
| learning-resource | KEEP: 11 |
| guide | IMPROVE: 10, NOINDEX: 5, REVIEW: 2 |
| help | IMPROVE: 12 |
| industry | IMPROVE: 1, REVIEW: 4 |
| workflows-templates | KEEP: 33 |
| template | KEEP: 17 |
| use-case | IMPROVE: 7, NOINDEX: 5, REVIEW: 2 |

Only the 16 safe search holds were applied. Educational definitions can remain useful independently of hidden related tools. Eleven mixed-purpose pages need further manual review, and 38 should be improved with tested examples and clearer task links. The merge/combine comparison is a consolidation proposal into `/merge-pdf`, pending page-level query and link evidence. No resource was deleted or redirected in this batch. The new locale alias redirects are separately verified equivalent-URL corrections, not content pruning.

The full 99-tool registry remains in code. The 26 public tools remain public; the 73 non-public tools retain their existing launch status. Backlinks, GSC performance and historical equity for individual hidden/resource URLs were not supplied, so none were permanently removed based on assumed low value.

## Search growth priorities and limitations

Start with publication and production verification, then measure wanted indexing coverage. Strengthen the six flagship tools and existing ten English owners; roll out the reviewed 20 Portuguese core pages and two distinct Portuguese tasks. Only then expand with actual capability and device evidence. See the [Brazil report](../../batches/2026-09-br/REPORT.md), [core operating table](../../batches/2026-09-br/CORE-TOOLS.md), [product-gap roadmap](../../batches/2026-09-br/PRODUCT-GAPS.md), [P0–P7 queue](../../batches/2026-09-br/GROWTH-QUEUE.md), and [authority plan](../../batches/2026-09-br/AUTHORITY.md).

[Measurement.md](MEASUREMENT.md) separates technical inventory, Google indexed/excluded evidence, search clicks/impressions and product conversions. GSC Performance, indexed-page coverage, live GA4 totals and a current URL-level backlink export are missing. SEMrush estimates are not substituted for them. No traffic target, rank improvement or immediate Google recovery is promised.

## Publication and verification

The final tested source is still an uncommitted local change set above `67682f5`. Full validation, production build and browser/HTTP evidence are saved in the batch evidence directory. The exact publish command is in [PUBLISH.md](../../batches/2026-09-br/PUBLISH.md). Running it pushes the reviewed commit to the already integrated GitHub production branch; Vercel then builds from that push. It has not been run.
