# PDF Pilot backend and release status

Updated 27 November 2026. This file and `activation-verification.md` are the source of truth for this release.

## Release checkpoint

PR [#56](https://github.com/saifsyed8527-droid/pdfpilot/pull/56) combines Supabase/Sentry with security commit b53a146. Production main is still `95604860e57f3adb4adc9dee16f1b8a834c99c69` until the final protected merge and Vercel deployment succeed.

- Root dependency audit: **zero vulnerabilities**. Previous candidate ec021ad passed all 587 tests, TypeScript, 19 SEO checks and a Sentry-enabled production build (3,030 static pages). The current candidate adds a seventh boundary test (588 total expected); exact-head CI remains the merge gate.
- Vercel's build-injected public metadata originally failed the strict environment allowlist. Reviewed identifiers, including `NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG`, are explicitly allowed; unknown names and secret values remain blocked. Corrected preview D2BKzuesTizMkZoyfr7CqvW88JyX reached production compilation. Final Ready state still required.
- Supabase/Vercel integration is confirmed in both dashboards. Two migrations are applied. Atomic counters, expiry reset, anonymous/authenticated denial, server-only RPC grants and empty SECURITY DEFINER search path are verified. Production application traffic still requires post-deployment verification.
- Sentry project `pdfpilot` in `hsa-enterprises-pvt-ltd` uses the approved owner account. Production DSN is configured. Event `d5a23225978d41299fb81c8a72d92381` is verified in [PDFPILOT-1](https://hsa-enterprises-pvt-ltd.sentry.io/issues/164156598/?project=4512503434510416): no processing warning, users 0, attachments 0, replay 0, generic message. This is synthetic SDK delivery, not a production-user crash.
- Privacy copy updated in English and 11 existing policy dictionaries. All 43 original checklist rows are applied in `privacy-checklist.csv`; live HTTPS/layout verification follows deployment. No new language or tool launch.
- Security chat independently confirms main protection with required `check`, `security` and `Vercel` checks, up-to-date branches, resolved conversations and no admin bypass. Secret scanning/push protection enabled. Cloudflare/Vercel MFA active; GitHub/Supabase MFA requires owner completion.

Full hosted verification: [run 45991860644](https://github.com/saifsyed8527-droid/pdfpilot/actions/runs/45991860644). Local production compilation passed but a later prerender exhausted disk; hosted full builds are the release evidence. Default-branch Dependabot alerts must be rechecked after merging the fixes, not dismissed.

## Screenshot stack and actual architecture

| Tool | PDF Pilot decision |
|---|---|
| Supabase | Active database-backed shared URL-import counters. No PDF storage, customer account or forced login added. |
| Claude | Codex is the owner's coding assistant. |
| Vercel | Existing frontend host plus five Next.js import API handlers; remains the HTTP backend. |
| Railway | Not needed for current bounded requests. Reconsider only for a specified long-running worker. |
| Stripe | Skipped per owner instruction. |
| ElevenLabs | No audio workflow specified; not activated. |
| Twilio | No phone workflow required; skipped. |
| Sentry | Error monitoring configured and synthetic delivery verified; production wiring verified after release. |
| PostHog | Existing GA4 covers current analytics. No replay enabled; add only for a defined unmet measurement need. |

The supplied attachment was one nine-tool stack image, not additional Supabase dashboard screenshots. The separate local `control-plane` is an operator project, not this public website's deployment target.

Ordinary conversions process documents in the browser and download locally. URL imports use `cloud-import`, `data-table/import`, `excel-to-xml/import`, `html-to-pdf/fetch` and `html-to-pdf/asset`. They enforce bounded requests, pinned public DNS, time/size limits, shared counters and local/edge limits. Supabase stores only keyed network hashes, counts and expiry times. Production backend errors fail closed with 503; exhausted budgets return 429 and Retry-After.

## Configuration and operating SOP

**Role:** owner defines the feature/data need; engineer implements and records checks.

**Inputs:** current release SHA, this status, feature requirement, provider access and reviewed migration.

1. Inspect existing code and provider state. Reuse the existing backend and minimize stored data.
2. Set server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Vercel Production. `SUPABASE_SERVICE_ROLE_KEY` is a legacy fallback. Never prefix server keys with `NEXT_PUBLIC_`; never put values in source, chat or reports. Preview/local can omit Supabase configuration and retain local limits. `.env.example` has empty placeholders.
3. Keep migrations versioned and grant access explicitly. Current table `private.import_rate_limits` denies direct access; only service_role executes `public.consume_import_limit`. For future user data, add auth and cross-user RLS tests before exposing it. Current defaults harden objects created by postgres; other creator roles need separate review.
4. Configure the public `NEXT_PUBLIC_SENTRY_DSN` for intended environments. No Sentry auth token/source-map upload is needed. SDK strips document data, raw messages, URLs, breadcrumbs, users and attachments; no replay, tracing, logs or metrics. Provider receives connection metadata and may derive geography; IP storage prevention is enabled. Sanitized generated chunk/line information is retained when available.
5. Run secret checks, audit, relevant regressions, TypeScript, SEO checks and hosted production build. Keep source-proof hashes/reviews consistent. Merge through required checks, verify Vercel Ready and domain, then smoke-test a real import and document conversion/download.
6. Record deployed SHA/URL, database evidence and monitoring delivery in `activation-verification.md`. Update the existing SEO tracker for privacy publication; keep release, indexing and field measurements distinct.

**Output:** verified release and concise evidence. **Rollback:** revert the app through a reviewed PR or restore the known Vercel production deployment. Leave private counters and restrictive database defaults in place; do not restore blanket public grants.

The secret guard checks known token formats and an explicit public-name allowlist; it is not a guarantee against every leak or compromise. Legacy Clarity ID remains as a harmless configuration value; the replay component and CSP permission are removed. Restrict Google/Dropbox public picker IDs in their provider consoles as applicable.

References: [Supabase API controls](https://supabase.com/docs/guides/api/securing-your-api), [Supabase key handling](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys), [Sentry options](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/), [Vercel framework variables](https://vercel.com/docs/environment-variables/framework-environment-variables).
