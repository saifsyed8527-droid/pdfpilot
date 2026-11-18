# Static public-page rendering release evidence

## Scope
Removes request-header-dependent document rendering by using separate English and locale root layouts. Public URLs and localized metadata are preserved. Route-specific related links use explicit paths; workspace locale is passed explicitly. Dynamic resources, integrations and APIs remain dynamic. No force-static fallback, infrastructure settings, dependency changes or paid services.

## Baseline and rollback
- Tested source: 90263b8, merge of static fix 4132f0d and production 034e6cbc95ad4b32573023eabbd5247d3bad9097.
- GitHub main verified as 034e6cb immediately before release preparation.
- Current Vercel production verified Ready/Current: dpl_8H2JUbBsApiXBR4JDQVznkBZbLx8, pdfpilot-baqs95ng1-saifsyed8527-5966s-projects.vercel.app. Retain as rollback target.
- Previous retained production has enabled Instant Rollback action. No rollback or settings changes performed.

## Tests
- Mac full merged suite: 524 tests passed, zero failed (71 seconds).
- Production Next.js build passed; generated locale HTML language/direction checks and representative cached HTTP responses passed.
- Real Chrome hydration/navigation: English Merge -> Arabic -> Italian -> Italian Split -> English Split -> English Compress -> English pSEO page. Correct language, direction, canonical and related links; no captured browser errors.
- All 19 SEO checks and pSEO capability-evidence validation passed. Historical approval artifact hashes preserved.

## Vercel packing gate
Separate local-only Vercel build completed successfully using UI-confirmed project settings: Next.js defaults, Node24, no command/output/root overrides. Local CLI60.1.3 versus previous remote CLI65.17.0; actual remote build remains the final platform check. No production environment secrets copied; local output is not uploaded as prebuilt Mac binaries.

- 103 adapter routing rules (limit2048).
- 2,295.54MiB regular output files plus 67.04MiB distinct traced server files.
- Six physical function bundles; largest mapped bundle59.30MiB (below250MB uncompressed function limit).
- Home and Merge prerender configuration expiration=false. Generated public HTML/RSC served as prerendered content rather than request-time document rendering.
- Mac available disk after isolated build6.1GiB; avoid extra duplicate builds.

## Cost and residual caveats
Vercel UI reported CPU3h53m of4h free allowance and project deployment-storage usage2.12GB for last30days. One approximately2.4GB release is within the10GB Hobby storage budget; aggregate UI period usage is not a real-time guaranteed storage balance. Repeated retained releases can consume storage. Existing usage does not reset with this patch. API, middleware and dynamic resource traffic still consumes compute. No promise of zero usage or absolute security. No paid plan, retention change, deletion or security-setting change authorized by this release.

References: https://vercel.com/docs/cli/build ; https://vercel.com/docs/limits ; https://vercel.com/docs/deployment-storage ; https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage
