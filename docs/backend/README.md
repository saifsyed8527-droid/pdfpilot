# PDF Pilot: stack, security aur next steps

Updated: 27 November 2026 (India). Base: GitHub `main` at `9560486`, remotely verified.
Branch: `codex/backend-foundation-20261127`. This is the source of truth for this backend work.

## Screenshot ke 9 tools

| Service | Verified state | PDF Pilot mein role / decision |
|---|---|---|
| Supabase | Existing PDF Pilot project active in Mumbai; initially no application tables, migrations, users or buckets. App has no Supabase client. | Database/account infrastructure available, application integration incomplete. Secure defaults applied below. No need to upload PDFs or force login for existing free tools. |
| Claude | Screenshot's coding assistant. | Owner currently uses Codex. Separate local control-plane docs retain Ollama/Qwen and historical Claude references; that is not the public app backend. |
| Vercel | Owner-confirmed host; Next.js site and five import API handlers in repository. Public site reachable. | Already handles frontend and current HTTP backend. Current deployment settings/secret scopes not inspected. |
| Railway | No integration/deployment configuration found in current app. | Not currently required. Consider a private worker service only for a defined long-running server job, with queue, resource limits, cancellation and deletion. |
| Stripe | No billing integration. | **Skipped per latest owner reply.** Earlier credit preference does not authorize billing now. |
| ElevenLabs | No SDK, API route or key reference found. | Await a concrete audio use case. PDF-to-audio would send selected text to a third party and needs an explicit user action, disclosure and cost limits. |
| Twilio | No integration found. | No phone/SMS workflow required; skip. |
| Sentry | Absent from baseline. SDK integration prepared locally, disabled without a valid DSN. Owner confirms no account/project yet. | Capture unexpected browser/server errors and existing React error boundaries. No replay, tracing, logs, metrics, document attachments or raw error messages. Not live. |
| PostHog | No integration found. | GA4 already provides conversion/search events. Clarity replay component was previously removed. Keep GA4 for current analytics; PostHog is optional for a specific unmet funnel/experiment requirement. Do not enable document-workspace replay by default. |

The attachment is one stack-list screenshot, not a Supabase dashboard walkthrough. No claims of reviewing additional screenshots.

## Current architecture

Browser document processing → downloaded result. Ordinary local conversions do not need a remote database.

Google/Dropbox/shared URL import → Next.js API routes on the current host → bounded public fetch → browser processing.

The five handlers are `cloud-import`, `data-table/import`, `excel-to-xml/import`, `html-to-pdf/fetch` and `html-to-pdf/asset`.

`../control-plane` is a separate private operator application. Its file-state/PostgreSQL adapter is not proof that PDF Pilot users have accounts or a database-backed product. Its production docs require auth, durable workflows, backups and policy checks before activation; no operator workflows were activated here.

## Work completed / pending

| ID | Work | State and evidence |
|---|---|---|
| B01 | Inventory / access | Complete for source + Supabase metadata. GitHub repo is public; rulesets returned empty. Classic branch-protection read returned 403: unknown, not proven absent. |
| B02 | Supabase defaults | **Applied remotely.** Migration `20261127102732_explicit_api_privileges.sql`. New objects created by `postgres` no longer automatically grant API roles access. Global PUBLIC function EXECUTE default also revoked. Verification: implicit API grants 0; global function revoke true; security advisors empty. |
| B03 | Secret guard | Local code ready: all `.env.*` ignored except empty example; key files ignored; known-secret patterns and browser-variable allowlist; build config validates loaded environment. Six focused regression tests. No detected known patterns in current scanned checkout. |
| B04 | CI check | Local GitHub Actions definition prepared; read-only permissions, pinned checkout, no credentials persisted. Runs on push/PR when published. Not yet running remotely or configured as a required branch check. |
| B05 | Sentry | Local SDK 11.19.0, privacy filters, instrumentation and error-boundary reporting. Actual SDK envelope test excludes the document canary. Account, project, DSN, disclosure review and real delivery verification remain pending. |
| B06 | Existing security fixes | Separate dirty checkout `../security-hardening-2026-11-27` has dependency, request-body, rate-counter, fetch and header work. Preserved; not copied, overwritten, merged or counted as deployed. |
| B07 | Deployment | Not performed. New local code must be reconciled with B06 and pass release checks. The 22 November audit recorded a Vercel deployment-storage hold; its current resolution is unverified. |

B02 affects only future objects created by `postgres`. Existing objects and managed `supabase_admin` defaults are unchanged. Use `postgres` for reviewed app migrations; another creator role requires a separate privilege audit. Every exposed user table still needs RLS and cross-user authorization tests. Empty advisor results are not an end-to-end security certification.

No customer document table/bucket, login, paid tier, public endpoint or automatic recurring job was created. Supabase foundation hardening does **not** mean the product backend integration is complete.

## Verification

- Supabase inspection: initial application tables 0, auth users 0, buckets 0, migrations 0; security/performance/health advisors empty. Last-24-hour log inspection used counts by service only, not payloads.
- New secret and Sentry tests, existing analytics privacy, no-replay, camera policy and asset sandbox tests: **29 passed**. Additional OCR, PDF-to-Word and scanner regressions: **26 passed**. Local logs: `verification-tests.log` and `verification-capabilities.log` (ignored build evidence).
- TypeScript whole-project check passed after SDK typing fixes.
- Lint passed with four existing warnings in unchanged tool components. All 19 prebuild checks and runtime evidence validation passed. Compilation succeeded; the first full build then failed with local `ENOSPC` during prerendering. Removed only this checkout's generated webpack cache and resumed with Next's `--experimental-build-mode generate`: all **3,030 pages generated**, optimization/tracing completed, exit 0. This verifies a recovered artifact, not a second clean full-build run. Re-run a normal build with adequate disk space before release.
- Configured Sentry wrapper and exact-ingest-origin CSP smoke check passed using a synthetic DSN, with no events sent. Actual account delivery is still unverified.
- Recovered production artifact served locally: `/`, `/merge-pdf`, `/hi/merge-pdf` returned 200; GET `/api/cloud-import` correctly returned 405. Disabled-mode CSP has no Sentry destination. Server stopped after the checks; see `runtime-smoke.json`.
- Existing analytics fixture used `{total: 2}` although homepage results are now an array. Updated only the test fixture; analytics production code unchanged.
- Build evidence reconciliation: with monitoring disabled, all Next.js response headers are byte-for-byte equivalent as structured values to base `main`. Updated only four source hashes covering Next config and the camera-test loader. Rebound the two PDF-to-Word capability reviews, preserving previous reviewer history, utility, platform evidence and content fingerprints. This is configuration compatibility revalidation, not fresh browser/platform certification, editorial approval or new tool-capability claims.
- Production dependency audit: 13 findings (1 critical, 11 high, 1 moderate). All affected installed versions were already in base `main`; details in `dependency-audit.json`. No clean-dependency claim. Reconcile with B06 before release.
- No customer files, live exploit tests or real Sentry events were used. No paid service was activated.
- Existing SEO tracker/rules were read; no SEO content, URL, keyword decision, live status or measurement changed. Backend progress remains here rather than changing unrelated SEO tasks.

The secret guard checks the current checkout, known token patterns and public environment names. It is not a full historical/entropy scanner, credential validity check or guarantee against compromise. Historical filename search across locally available refs found no `.env*`, `.pem` or `.key` paths; historical content was not comprehensively scanned.

## SOP: safe backend changes

**Role:** owner defines feature/data need; engineer implements; reviewer checks evidence.

**Inputs:** current branch, this status, existing security audit, exact feature, data retention needs and provider access.

1. Inspect existing implementation and live provider metadata. Identify the minimum data and permission required.
2. Keep credentials in deployment secrets / local ignored env; browser variables are public. Review additions to the allowlist. Google/Dropbox browser keys also need provider-side origin/API restrictions.
3. Keep migrations in `supabase/migrations` with the exact remote version. Give each API object explicit grants and RLS in the same migration. Test anonymous, user A, user B and server access. Never use an admin key in client code.
4. Keep files browser-local unless a feature explicitly requires upload. If needed, use private storage, owner access, bounded signed URLs, deletion/retention and resource limits.
5. Run `npm run check:secrets`, relevant tests, typecheck and build. Inspect telemetry with synthetic canaries. Record what is local, configured, verified and deployed separately.
6. For release, reconcile B06, resolve dependency findings, verify deployment capacity, secret scopes, preview/production isolation and rollback. Activate one service at a time and verify the real workflow.

**Output:** one reviewed change, evidence, rollback path and updated rows above.

**Rollback:** local app changes revert to the prior compatible version. Supabase defaults do not affect existing data; restore only specific explicit grants needed by a reviewed feature. Do not restore blanket public grants as a routine rollback.

## Sentry activation handoff

1. Owner creates/signs in to Sentry, selects region and creates a Next.js project. Check plan and spending limits before activation.
2. Provide the **public DSN**; never paste an auth token/password in chat. Add `NEXT_PUBLIC_SENTRY_DSN` to preview only first. No Sentry auth token is required for this setup; source-map upload is disabled.
3. Configure provider-side IP/data scrubbing and retention; review/update the privacy disclosure through existing publication checklists. Even stripped SDK payloads have transport metadata.
4. Build preview, verify CSP allows only the DSN's exact ingest origin, trigger one synthetic TypeError and confirm delivery with no filename/content/cookie canary. Verify reset/retry still works and disabled config makes no monitoring requests.
5. Set a useful alert recipient/channel and verify one alert. Only then activate on production through a reviewed release.

Current coverage: unhandled exceptions, request-error hooks and React boundary errors. Handled conversion failures remain aggregate GA4 events. Error messages and source snippets are intentionally removed; debugging uses error type and generated chunk/line information. No readable source maps are uploaded in this first phase. Hosted Sentry DSNs are supported; self-hosted endpoints need a reviewed configuration change.

## Next order

1. Finish/reconcile existing dependency and import-security hardening, then verify the combined release candidate.
2. Create the Sentry account/project and verify preview delivery.
3. Define the first actual Supabase-backed feature (for example optional saved settings). Then implement its minimal schema, auth and RLS together. Keep current free conversions usable without signup.
4. Review distributed abuse protection on the existing API routes. In-memory per-instance limits are not a global limit; verify Vercel edge controls before introducing another datastore.
5. Add Railway, PostHog or ElevenLabs only for a specified workload/measurement/audio feature. Stripe and Twilio remain skipped.

References: [Supabase API access controls](https://supabase.com/docs/guides/api/securing-your-api), [PostgreSQL default privileges](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html), [Sentry Next.js setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/), [Sentry data handling](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/), [PostHog replay privacy](https://posthog.com/docs/session-replay/privacy), [Railway services](https://docs.railway.com/services), [Vercel functions](https://vercel.com/docs/functions/limitations).
