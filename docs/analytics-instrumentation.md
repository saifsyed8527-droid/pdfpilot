# Analytics instrumentation — Phase 3

## This was not a blank slate

Before this sprint, `src/components/analytics/` already wired real Google
Analytics 4 (`GoogleAnalytics.tsx`) and Microsoft Clarity (`Clarity.tsx`)
into the root layout, gated on real env vars
(`NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_CLARITY_PROJECT_ID`) that
are populated in `.env.local` with what are, by every indication, real,
live property IDs — not placeholders. One event
(originally `download_success`, renamed below) already fired on every
successful tool conversion via the shared `useProcessingTask` hook.

This sprint's brief assumed analytics was "architecture only, no live
tracking" and asked to prepare instrumentation without analyzing data.
That assumption didn't hold — live tracking already existed. This was
surfaced explicitly before extending it further, since adding more event
calls means real additional data flowing to a real, already-connected GA4
property, a different kind of change than the rest of this sprint's
inert architecture work. Confirmed to proceed with real extension.

## Event taxonomy (`src/lib/analytics/events.ts`)

One file, one place, every GA4 event PDFPilot sends:

| Event | Fires when | Parameters |
|---|---|---|
| `tool_conversion_completed` | Any tool's processing task succeeds | `tool_name` |
| `tool_conversion_failed` | Any tool's processing task throws | `tool_name`, `error_message` |
| `search_performed` | 600ms after the user stops typing a non-empty search query | `search_term`, `result_count` |
| `search_result_clicked` | A search result link is clicked | `search_term`, `result_type`, `result_path` |

`tool_conversion_completed`/`_failed` are wired once, in
`use-processing-task.tsx` — every one of the 35 tools gets both events for
free, with zero per-tool code. `search_performed`/`search_result_clicked`
are wired in `home-client.tsx`, the single search implementation.

Verified live this sprint: typing "compress" in the search box produced a
real `search_performed` GA4 hit (`search_term=compress&result_count=6`)
against the real measurement ID, visible in the network panel during
testing.

## What's deliberately not built

- **No new provider integrations** (Meta Pixel, Google Ads, LinkedIn
  Insight, TikTok Pixel) — `Analytics()` in
  `src/components/analytics/index.tsx` already documents itself as "add
  new providers here," but none were requested or justified this sprint.
- **No dashboards, funnels, or data analysis** — this sprint added
  instrumentation (what gets measured), not analysis of what's already
  been measured. That's explicitly out of scope per the brief.
- **No Search Console wiring** — Search Console is a separate Google
  product (crawl/index visibility, not client-side event tracking) that
  requires domain verification outside this codebase; nothing to
  instrument in application code for it.
