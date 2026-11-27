# Backend activation verification — 27 November 2026

Combined security commit b53a146 with backend foundation 1c0ac77. Source fingerprints refresh only: historical page approvals, copy, layout and platform claims remain unchanged.

- Combined dependency audit: zero findings (all severities), saved in dependency-audit.json.
- Supabase migration 20261127111040 applied. Private counter storage with RLS; only service_role can execute the atomic fixed-window function. Anonymous and authenticated roles denied. Transactional test verified allow/allow/deny and expiry reset, then rolled back synthetic data.
- Intentional security-advisor INFO: private table has RLS and no policies, denying all direct user access. SECURITY DEFINER function has fixed empty search_path and explicit server-only execute grant.
- Five import routes share keyed-hash counters; no document, filename, URL or raw IP stored in this table. Missing production configuration and backend errors fail closed; local per-instance and edge limits remain.
- Sentry project pdfpilot created in hsa-enterprises-pvt-ltd using the owner-approved account. Production public DSN saved in Vercel. Error payload scrubber, no replay/tracing/logs, no source-map upload.

Release checks and live evidence are recorded below as they complete. This file does not yet assert deployment.

## Release candidate validation

Full combined suite initially passed 583/587; four config-loader/source-proof failures were fixed. All 65 affected regression checks then passed. Monitoring regression passed 5/5 after omitting empty optional stack traces. Final CI reruns the complete suite and TypeScript.

Sentry-enabled local production compile passed; prerender failed because the Mac disk filled. Removed only this worktree's generated build/cache. Final hosted build is the release gate; no full local build pass is claimed.

Live Sentry event 57aa0a5f19c941fdb04409dfdf2fd940 confirmed in issue PDFPILOT-1. Canary/document content, URLs, user identifiers and attachments absent. IP storage prevention enabled. Provider enriches approximate geography from transport metadata. Empty optional stack caused a processing warning; corrected and second event d5a23225978d41299fb81c8a72d92381 sent for verification.

Privacy checklist: all 43 source factor/subfactor rows in privacy-checklist.csv. Existing /privacy topic owner retained; Sentry, Supabase, error reports and import protection are supporting factual coverage, not new researched keyword targets. Eleven existing policy dictionaries updated; no deferred locales launched.

Legacy NEXT_PUBLIC_CLARITY_PROJECT_ID remains in Vercel. The guard recognizes this non-secret historical ID; no Clarity component or CSP access is restored. Editing it requires owner MFA and is unnecessary for disabling replay.

Sources: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys and https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/ .
