# Files for the US / India data batch

Paths are relative to the `pseo-engine` checkout. This inventory uses the snapshot saved before the first real import, so it does not attribute the earlier uncommitted engine implementation to this batch. It includes the subsequent deployment readiness update.

## Modified existing files

- `.gitignore`
- `data/pseo/manifests/candidates.json`
- `data/pseo/manifests/reviews.json`
- `data/pseo/manifests/state.json`
- `data/pseo/reports/latest.json`
- `docs/pseo/README.md`
- `next.config.ts`
- `package.json`
- `scripts/check-pseo-engine-http.cjs`
- `scripts/pseo-import.cjs`
- `scripts/pseo.cjs`
- `src/app/excel-to-pdf/tool-page.tsx`
- `src/app/pseo-preview/[slug]/page.tsx`
- `src/lib/content/pseo-pages.json`
- `src/lib/pseo/capabilities.json`
- `src/lib/pseo/classify.ts`
- `src/lib/pseo/content.ts`
- `src/lib/pseo/quality.ts`
- `tests/pseo-engine.test.cjs`

## Created maintained files

- `data/pseo/manifests/review-records/compress-pdf-on-mac.json`
- `data/pseo/manifests/review-records/edit-pdf-on-mac.json`
- `data/pseo/manifests/review-records/edit-pdf-resume.json`
- `data/pseo/manifests/review-records/excel-to-pdf-landscape.json`
- `data/pseo/manifests/review-records/jpg-to-pdf-whatsapp-images.json`
- `data/pseo/manifests/review-records/pdf-to-excel-bank-statements.json`
- `data/pseo/manifests/review-records/pdf-to-powerpoint-on-mac.json`
- `data/pseo/manifests/review-records/pdf-to-word-on-mac.json`
- `data/pseo/manifests/review-records/pdf-to-word-scanned.json`
- `data/pseo/manifests/review-records/png-to-pdf.json`
- `data/pseo/reports/capability-gaps.json`
- `data/pseo/reports/core-tools.json`
- `data/pseo/reports/opportunities.json.gz`
- `data/pseo/reports/page-research.json`
- `data/pseo/reports/prioritization.json`
- `data/pseo/reports/research-summary.json`
- `docs/pseo/batches/2026-09-us-in/FILES.md`
- `docs/pseo/batches/2026-09-us-in/REPORT.md`
- `docs/pseo/batches/2026-09-us-in/before-files.json`
- `docs/pseo/batches/2026-09-us-in/cannibalization.json`
- `docs/pseo/batches/2026-09-us-in/core-comparison.json`
- `docs/pseo/batches/2026-09-us-in/editor-output-check.json`
- `docs/pseo/batches/2026-09-us-in/files.json`
- `docs/pseo/batches/2026-09-us-in/logs/approved-page-qa.log`
- `docs/pseo/batches/2026-09-us-in/logs/build.log`
- `docs/pseo/batches/2026-09-us-in/logs/core-functional.log`
- `docs/pseo/batches/2026-09-us-in/logs/core-uploads.log`
- `docs/pseo/batches/2026-09-us-in/logs/core-visual.log`
- `docs/pseo/batches/2026-09-us-in/logs/lint.log`
- `docs/pseo/batches/2026-09-us-in/logs/routes-sitemaps.log`
- `docs/pseo/batches/2026-09-us-in/logs/tests.log`
- `docs/pseo/batches/2026-09-us-in/logs/typecheck.log`
- `docs/pseo/batches/2026-09-us-in/logs/validate.log`
- `docs/pseo/batches/2026-09-us-in/ocr-initial-failure.json`
- `docs/pseo/batches/2026-09-us-in/protected-source-integrity.json`
- `docs/pseo/batches/2026-09-us-in/qa/candidate-results.json`
- `docs/pseo/batches/2026-09-us-in/qa/compress-pdf-on-mac.json`
- `docs/pseo/batches/2026-09-us-in/qa/core-results.json`
- `docs/pseo/batches/2026-09-us-in/qa/edit-pdf-on-mac.json`
- `docs/pseo/batches/2026-09-us-in/qa/edit-pdf-resume.json`
- `docs/pseo/batches/2026-09-us-in/qa/excel-to-pdf-landscape.json`
- `docs/pseo/batches/2026-09-us-in/qa/functional-results.json`
- `docs/pseo/batches/2026-09-us-in/qa/http-results.json`
- `docs/pseo/batches/2026-09-us-in/qa/jpg-to-pdf-whatsapp-images.json`
- `docs/pseo/batches/2026-09-us-in/qa/pdf-to-excel-bank-statements.json`
- `docs/pseo/batches/2026-09-us-in/qa/pdf-to-powerpoint-on-mac.json`
- `docs/pseo/batches/2026-09-us-in/qa/pdf-to-word-on-mac.json`
- `docs/pseo/batches/2026-09-us-in/qa/pdf-to-word-scanned.json`
- `docs/pseo/batches/2026-09-us-in/qa/png-to-pdf.json`
- `docs/pseo/batches/2026-09-us-in/qa/production-results.json`
- `docs/pseo/batches/2026-09-us-in/qa/upload-results.json`
- `docs/pseo/batches/2026-09-us-in/reimport-verification.json`
- `docs/pseo/batches/2026-09-us-in/source-validation.json`
- `docs/pseo/batches/2026-09-us-in/verification.json`
- `scripts/check-pseo-batch.cjs`
- `scripts/check-pseo-ownership.cjs`
- `scripts/pseo-research.cjs`

## Preserved local research data and complete ledgers

These files are intentionally ignored by Git. The complete opportunity report is also included in Git as `data/pseo/reports/opportunities.json.gz`.

- `data/pseo/sources/IN/42304e096312cf1b7d0542ad/ilovepdf.com-keywords-30000rows (1).csv`
- `data/pseo/sources/US/cdec6eef0b9f419858d145b9/ilovepdf.com-keywords-30000rows.csv`
- `data/pseo/normalized/42304e096312cf1b7d0542ad.jsonl`
- `data/pseo/normalized/cdec6eef0b9f419858d145b9.jsonl`
- `data/pseo/reports/capability-gaps.csv`
- `data/pseo/reports/keyword-observations.csv`
- `data/pseo/reports/keyword-to-page.csv`
- `data/pseo/reports/opportunities.csv`
- `data/pseo/reports/keyword-to-page.jsonl`
- `data/pseo/reports/opportunities.json`
- `data/pseo/rejected/latest.json`

## Local browser evidence

237 local browser artifacts under `docs/pseo/qa/batch-*` are enumerated in [files.json](files.json). Build outputs and dependencies are excluded.

No existing file was deleted during this batch.
