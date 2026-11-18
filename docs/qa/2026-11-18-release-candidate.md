# Scoped PDF reliability and asset security release candidate

Base and verified production before release: c4996a68bf53da20b65eca94df3780da6aad0c4c. Vercel production deployment 6yEA7zaNjGdUpYJuXm51jb4RR9oJ, pdfpilot-7r7cmcx49-saifsyed8527-5966s-projects.vercel.app. Existing project updates on main push and exposes Instant Rollback.

Local validation completed: 35 conversion regressions; 53 asset/HTML/OCR/Word/scan regressions; 19 SEO/language prebuild checks; evidence-bound runtime capability validation (26 scope tools, 18 reviewed pages); full Next production build with 3160 static pages; TypeScript and targeted lint. Full build retains four pre-existing lint warnings in unrelated compress/crop/pdf-image clients. This is not a full 109-tool test or complete security clearance.

Real Chrome on macOS via the user browser tested the local production build: actual file picker, four-page synthetic text-and-images PDF, four-slide downloaded PPTX, then four-page downloaded PDF. All four ordered captions were independently parsed from the actual downloaded archives and PDF. Earlier development-output pages were visually inspected, and 48-page engine fixtures check distinct images/order. Local production asset endpoint responds with the required sandbox CSP. No customer documents used and no production load test.

A timed-out browser download-event wait did not indicate conversion failure: the UI showed ready and the actual output file existed and was independently inspected. Earlier premature file-input automation failed before hydration; actual button filechooser flows passed. These automation issues are not asserted as product defects.

Release scope: page-preserving PDF-to-PPT handling and JPEG default, explicit missing text report with existing translations, passive untrusted asset sandbox at route and exact Next header path, regressions and legitimately renewed evidence. Existing unrelated worktrees preserved. No auth, billing, infrastructure settings or paid services changed. No test upstream preload included. Older cached asset responses may persist for their one-hour max-age; verify cache behavior after release.

Rollback target is the prior deployment above or a Git revert of this scoped commit. Production completion requires Vercel Ready on the new exact SHA and live header verification; local build success alone is not deployment.
