# PDF Pilot security audit — 27 November 2026

Security hardening is implemented on `codex/security-hardening-20261127`, based on production/main `95604860e57f3adb4adc9dee16f1b8a834c99c69`. Application changes are **not deployed**. The separate local control plane is also patched but not deployed. Vercel and Cloudflare API firewall rules are live; their exact scopes are below.

## Scope and evidence

Read the complete supplied **The Ultimate Vibe Coding Security Audit Guide.docx**, including all 30 prompts and 15 deployment checks. Its embedded commands were treated as reference material, not user authorization. Source fingerprint: [guide-source.json](evidence/guide-source.json).

Reviewed the current production source, all five server import handlers and their shared fetch/input boundaries, conversion/parser entry points, dependency tree, security headers, analytics privacy, build/release checks, local operator control plane, and connected GitHub/Vercel/Supabase metadata. The public application has 109 browser tools. It has no account system, private user-record API, checkout, reward engine, or public AI agent. The new Supabase project has no public tables or storage objects. Adding those systems would create unnecessary attack surface.

This is a defensive source/configuration review with regression tests. It is not a penetration-test certification, exhaustive fuzzing of every parser, or proof of zero vulnerabilities. No customer documents, secret values or personal database records were extracted. No live flood, destructive payload or secret rotation was performed.

## Findings and implemented fixes

| ID | Priority | Finding and impact | Change / evidence | Release state |
|---|---|---|---|---|
| S01 | High | Known vulnerable dependencies, including framework and document parsing paths | 20 affected dependency nodes (1 critical, 12 high, 7 moderate) → **0 audit findings**. Updated Next 15.5.29, PDF.js 6.2.108 and worker, YAML/Zod/Sharp/PostCSS and vulnerable transitive packages. `package-lock.json`; audit JSON before/after. Advisory severity does not prove exploitability in this app. | Local |
| S02 | High | Request-body streams could hold work open; unexpected JSON shapes and fields crossed route boundaries | 5-second read deadline/cancellation, streamed byte cap, strict JSON MIME, object-only payloads, field allowlists, type checks, prototype-key rejection. `src/lib/server/request-guard.ts`; all five routes reviewed. | Local |
| S03 | High | Import requests needed stronger SSRF and resource exhaustion boundaries | Public address validation including mapped/transition IPv6, all DNS answers checked, connection pinned, each redirect revalidated, bounded bytes, total 25-second deadline including DNS, 10-second idle timeout, 8 concurrent imports/process, cancellation, no unbounded redirect drain. No cookies or authorization forwarded. `safe-public-fetch.ts`. | Local |
| S04 | Medium | Client forwarding headers could influence rate buckets; buckets grew without a cap | Trust only Vercel-controlled header on Vercel, validate IP, cap 10,000 buckets, expire old entries, fail closed. Per-instance backstop only. Verified Cloudflare egress uses a separate 1,200/minute/process aggregate backstop per route, not a visitor identity. No caller-supplied Cloudflare visitor header is trusted. Cloudflare edge enforces visitor limits. | Local; edge live |
| S05 | High | Office archive and PDF rendering allocations could exhaust a browser tab | ZIP metadata preflight at DOCX/XLSX/shared Office entry points; archive byte/entry/expanded-size/XML limits, unsafe paths rejected. PDF input/canvas/cumulative pixel budgets. `archive-guard.ts`, `render-budget.ts`; real Office/PDF regression outputs. These are not a malware scanner or universal parser sandbox. | Local |
| S06 | Medium | Unsafe object keys and dynamically constructed CSV regex increased attack surface | Null-prototype result/entry objects, PPTX path/prototype restrictions, literal delimiter splitting; adversarial tests preserve data without prototype mutation. | Local |
| S07 | Medium | API responses needed consistent privacy and hosting-size limits | API no-store/noindex/no-referrer; imported assets retain restrictive sandbox CSP. Assets capped 4 MiB including rewritten CSS; HTML 3 MiB and serialized JSON 4 MiB. Raw OS/network errors suppressed. | Local |
| S08 | High | Dormant operator console could accept disabled production authentication or forged proxy identity | Production auth bypass rejected. Proxy identity requires constant-time shared-secret verification; production API enforced read-only, response hardening and async error handling. `../control-plane/src/{auth,http,server}.js`. 41 tests pass. | Local separate project |
| S09 | Medium | No dedicated dependency/secret regression gate | Pinned, read-only GitHub workflow on PR/main; audit, secret tripwire, typecheck and tests. Environment/key ignores. Known-pattern scan of working files/local history found no matches; not a comprehensive credential inventory. | Local workflow |
| S10 | Medium | Direct Vercel API endpoints lacked an explicit project abuse rule | Published rule: path starts `/api/` **AND hostname ends `.vercel.app`**, 300 requests / 60 seconds / IP, 429. Header logging disabled. Excludes the Cloudflare-proxied custom domain to avoid treating many users as one IP. | Live |

Cloudflare also now has an **active API-only rate rule: 120 requests / 10 seconds / visitor IP; block for 10 seconds**. Free plan constraints determine the period/action. Existing TLS **Full (strict)** was verified and preserved. Both rules leave browser-local processing outside their match.

First build revealed stale capability evidence and a lint error. The evidence hashes were refreshed after engine changes and the lint error fixed. Existing page copy, layout, review dates, approval status and release state were preserved; refreshed hashes are technical compatibility evidence, not a new editorial approval. An obsolete analytics test fixture was corrected to match the real array-shaped data.

## All 30 document categories

`Fixed` means the identified scoped issue has a local implementation and tests, unless a live state is expressly stated. `Existing` means a concrete relevant control was inspected, not that every possible attack was proved absent. `Partial` remains open. `N/A` is excluded from completion claims.

| # | Guide category | Status | Application / evidence / remaining check |
|---|---|---|---|
| 1 | Broken access control | Fixed | Public import routes intentionally anonymous. Control-plane production writes denied after authentication; proxy identity verified (`control-plane/tests/security-hardening.test.js`). |
| 2 | IDOR / BOLA | N/A | No public account-owned records/endpoints; cloud imports fetch public URLs without user credentials. Revisit before introducing saved documents. |
| 3 | Exposed API keys | Partial | Working tree/local history tripwire clean. Platform-held secrets, scopes, account audit and rotation history not inspected end-to-end. |
| 4 | Price manipulation | N/A | No checkout or price-calculation backend. |
| 5 | Negative quantity exploit | N/A | No inventory/order transactions. Input/body/render budgets independently implemented. |
| 6 | Fake payment | N/A | No payment provider or order-paid state. |
| 7 | Coupon/reward abuse | N/A | No redemption/reward backend. |
| 8 | Privilege escalation | Fixed | Production control-plane mutation boundary enforced; no client-selected role assignment introduced. Fine-grained roles still required before enabling write agents. |
| 9 | Authentication/OTP bypass | Partial | Production bypass/proxy spoof fixed. Public app has no OTP. Cloudflare two-factor authentication explicitly **inactive** in dashboard; owner setup required. GitHub/Vercel/Supabase MFA and recovery remain unverified. |
| 10 | Prompt injection | Existing | No public AI execution endpoint; control-plane agents/publishing remain disabled. External document/page text is data. No new autonomous authority granted. |
| 11 | XSS | Partial | Existing escaped JSON-LD, script-disabled HTML/Word iframe sandbox and imported-asset CSP retained; unused Clarity origins removed. Page-wide inline scripts remain allowed for static Next hydration; strict nonce/hash CSP and comprehensive browser attack corpus not completed. |
| 12 | Malicious files | Fixed | Office metadata budgets/unsafe paths and PDF render budgets added; parser regression tests pass. Browser-only processing avoids server file persistence. Legacy/binary parser fuzzing and all-tool worker isolation remain outside this fix. |
| 13 | Environment exposure | Partial | `.env.*`/private-key ignores and location-only secret scanner added. Known-pattern local history clean. Provider secret inventory and all deployed bundle/log access remain unverified. |
| 14 | SQL/NoSQL injection | Existing | No public runtime database queries. Local PostgreSQL store uses parameterized queries; client SQL converters produce downloadable text, not database execution. |
| 15 | JWT | Existing | Public app does not accept bearer JWT login. Local Google service-account signer pins RS256/audience/expiry; it is not a user-token verifier. No JWT auth added. |
| 16 | Rate limits / DoS | Fixed | Bounded per-instance counters/concurrency/deadlines and file/render caps; Vercel and Cloudflare API rate rules active. Cloudflare CIDRs identify aggregate egress only (1,200/minute/route/process), never grant access or trust visitor headers. Live multi-visitor threshold behavior remains untested; no global counter guarantee. |
| 17 | RLS bypass | Existing | Connected Supabase security advisor: no lints; public tables 0, storage buckets/objects 0; all 10 storage tables have RLS. Vendor internal schemas not modified. Cross-user policy tests become required when real application tables exist. |
| 18 | Predictable tokens | Existing | Control-plane identifiers use `crypto.randomUUID`; no reset/session token feature in public app. IDs do not confer authorization. |
| 19 | CSRF | Fixed | Import body guard rejects cross-site Fetch Metadata and foreign/null Origin; strict JSON prevents simple form posts. Asset route rejects cross-site fetches. Control-plane existing origin check plus production read-only boundary. |
| 20 | CORS | Existing | No broad credentialed CORS policy added. Same-origin APIs and import origin restrictions; browser preflight cannot authorize a foreign origin. |
| 21 | SSRF | Fixed | Public address/DNS pinning/redirect checks, no credential forwarding, byte/time/concurrency caps; dedicated mocked-network regression tests. |
| 22 | Session management | N/A | Public app has no authenticated sessions. Operator Basic/proxy auth is not a session implementation; an identity provider with MFA is required before broader activation. |
| 23 | OAuth/SSO | Existing | No public OAuth login callback/account binding. Google/Dropbox pickers select files; Google service-account flow remains backend-only. Account configuration not certified. |
| 24 | Prototype pollution | Fixed | Request keys/Office paths restricted; data/PPTX maps have null prototypes; malicious-key regression cases. |
| 25 | Regex DoS | Fixed | User CSV delimiter no longer constructs RegExp; server text/URL/body inputs bounded. Not a proof of every third-party regex's complexity. |
| 26 | WebSocket hijacking | N/A | No public application WebSocket handler or private realtime channel. Supabase service infrastructure alone is not an app channel. |
| 27 | SSTI | Existing | React/static content and downloadable conversion outputs; no server evaluation of user template source found. Imported HTML scripts remain sandboxed. |
| 28 | Dependencies | Fixed | Audit 20 → 0; lockfile and PDF.js worker synchronized; pinned CI actions and repeatable audit gate. Scanning is advisory coverage, not supply-chain certification. |
| 29 | Mass assignment | Fixed | Explicit API field allowlists/type validation; no raw request spread into a persistence model. |
| 30 | Misconfiguration | Partial | API/header/error limits, local console hardening and CI added. Main branch protection absent; platform MFA, retention/restore, deployed verification remain open. Cloudflare API rule and strict TLS verified. |

Coverage accounting: **30/30 categories reviewed; 7 not applicable; 10 fixed, 8 existing scoped controls, 5 partial**. This is **18/23 applicable categories addressed at the stated scope (78%)**, not “78% secure” and not production completion. N/A items are not counted as implementation. The requested >80% completion bar is **not yet met honestly**, because the remaining infrastructure/access checks matter. The local code improvement should not obscure those gaps.

## Verification

- Full application suite: **573/573 passed**, 0 skipped; [log](evidence/app-tests.log). Covers actual conversion/output fixtures and new request, SSRF, file-budget, prototype and delimiter cases.
- Separate control-plane suite: **41/41 passed**, 0 skipped; [log](evidence/control-plane-tests.log).
- TypeScript check passed; [log](evidence/typecheck.log).
- Build preflight: 19 SEO/internationalization checks passed; 26 scoped capabilities and 18 reviewed pages validate. No editorial page changes.
- Dependency audit: [before](evidence/npm-audit-before.json), [after](evidence/npm-audit-after.json), zero reported vulnerabilities after installation.
- Known-pattern secret scan: [result](evidence/secret-scan.json); matched values are never printed.
- **Production build passed**, all 3,030 static pages generated. Initial disk exhaustion resolved by clearing only this task generated caches; existing non-blocking image/ref/content-graph warnings remain. [Build log](evidence/production-build.log).
- **7/7 local production HTTP smoke checks passed**: all five API handlers reject the selected invalid/cross-origin/private-network inputs and return privacy headers; page and PDF worker return 200. [Evidence](evidence/local-http-smoke.json).
- **Real browser PDF-to-JPG passed**: downloaded ZIP independently decoded into two nonblank 1667×2084 JPGs; first image visually inspected. No browser console errors observed. [Evidence](evidence/browser-conversion.json).
- Final validation summary: [verification.json](evidence/verification.json).
- Live Chrome check after both firewall rules: Merge PDF page loaded normally. This is availability evidence, not patched-code conversion verification.
- Live custom-domain automated requests received **Cloudflare 403 / error 1010**, not app responses. Do not infer missing app headers or downtime from those challenges. [Evidence](evidence/live-after-firewall.json).
- Vercel rule publication verified in dashboard; no live 301-request flood was performed. [Infrastructure observations](evidence/infrastructure-observations.json).

## Deployment checks from the guide

| Check | State |
|---|---|
| Appropriate endpoint authorization | Scoped implementation tested; production release pending |
| Resource ownership | N/A until private user records exist |
| No confidential API keys exposed | Local tripwire clean; provider/bundle inventory incomplete |
| Server-side price/payment verification | N/A |
| Authentication/OTP secured | Control-plane code fixed; provider MFA unverified |
| Backend inputs validated | Local implementation and tests pass |
| Database queries protected | Existing parameterized operator-store queries; no public DB API |
| Files handled safely | Added bounded guards; no exhaustive malicious-file certification |
| JWT/session security | No public login/session; operator controls as above |
| Rate/resource protection | Local caps + direct Vercel edge rule; Cloudflare visitor edge rule live; end-to-end threshold smoke pending |
| Database access policies | Empty public schema and clean advisor verified; future tenant policies not tested |
| AI tool permissions restricted | Public AI runtime absent; operator writes/agents remain disabled |
| Dependencies scanned | Zero current audit findings; CI workflow not yet run remotely |
| Production hardened | Partial: release, owner settings and deployed validation remain |
| Regression tests passed | 573 application + 41 control-plane tests |

## Remaining priorities and release conditions

1. **Before app deployment:** verify real imports and controlled rate behavior on preview and through Cloudflare. Both edge rules are active. The app uses only Vercel-controlled peer identity; known Cloudflare egress receives an aggregate 1,200/minute/route/process backstop. It never trusts `CF-Connecting-IP` as authorization or identity. Review official Cloudflare IP ranges when infrastructure changes. No controlled two-visitor production rate test was run.
2. **Immediate owner action:** Cloudflare two-factor authentication is **inactive** (verified in Authentication settings). Enable a security key or authenticator yourself and save recovery codes privately. Google social login is connected, but its MFA was not inspected and does not establish Cloudflare MFA. Also verify GitHub/Vercel/Supabase MFA/recovery, minimum account/token scopes and proxy origin isolation before broader operator activation. Production remains read-only; no automation/publishing workers are enabled.
3. Enable main-branch protection with passing checks after the workflow has actually run. Review/merge the security change through the existing release process. No automatic production merge/deploy is authorized by this report.
4. Complete provider secret inventory, deployed bundle/log review, retention and restore evidence. Do not rotate credentials blindly without dependency mapping. Supabase has no application records yet; define ownership/RLS/storage policies and adversarial two-user tests when that feature is built.
5. Plan strict page CSP separately against real hydration, analytics, pickers and all worker flows. Current CSP keeps `unsafe-inline` for scripts/styles; it is defense in depth with a known limitation.
6. Monitor artifact capacity: observed 9.5 GB / 10 GB on Vercel Hobby. Do not delete retained deployments without an agreed rollback/retention policy.

Release smoke: representative merge, PDF→image (including WASM decoder), DOCX→PDF, XLSX import, HTML public import and failure UI; confirm output opens, worker version matches, no sensitive telemetry, API privacy headers, cache bypass and controlled 429. Include at least two distinct visitors through Cloudflare. Rollback application via previous Vercel deployment/commit; the independently published firewall rule must be adjusted separately if necessary. No background monitoring was created.

## Official references

- [Cloudflare request headers and Worker trust caveats](https://developers.cloudflare.com/fundamentals/reference/http-headers/); [official IPv4 ranges](https://www.cloudflare.com/ips-v4), [IPv6 ranges](https://www.cloudflare.com/ips-v6).
- [Vercel request headers and proxy trust](https://vercel.com/docs/headers/request-headers).
- [Vercel WAF rate limiting and regional counters](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).
- [Next.js security advisory](https://github.com/vercel/next.js/security/advisories/GHSA-pc58-hwjq-p385).
- [PDF.js security advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j).
- [Zod security advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

## Concurrent backend work

`../backend-foundation-2026-11-27/docs/backend/README.md` documents a separate active backend change based on the same main commit: opt-in privacy-filtered Sentry, stronger public-env guards, CI, and remotely applied Supabase default-privilege migration. It explicitly references this security branch. Those files were read and preserved, not copied or merged. Before release, reconcile overlapping package/lockfile, headers, secret gates, workflow and capability hashes; run the combined suite. Do not deploy either branch as if it already includes the other. Supabase observations here are snapshots; the separate migration is not claimed as work performed by this audit.
