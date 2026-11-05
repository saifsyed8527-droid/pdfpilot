# Google Drive and Dropbox file selection

## Change

The shared upload button now has vertical Google Drive and Dropbox icon buttons. The workspace add-files button opens computer, Drive and Dropbox choices. This replaces the public-link dialog without changing PDF processing, ordering or result screens.

Google uses its Identity Services token popup and official Picker with only `drive.file`. Tokens remain in the selection callback and go only to the fixed Google Drive API. Native Workspace files export to an input format accepted by the current tool. Dropbox uses the official Chooser with temporary direct links; PDFPilot requests no Dropbox OAuth token. Both paths validate count, type and streamed size before accepting a batch, and support cancellation.

The four `NEXT_PUBLIC_*` picker settings are browser configuration, not client secrets. The Google browser key is restricted by website and API; the Dropbox app restricts Chooser domains. No credential values are recorded here. Production settings were entered in Vercel. The Google app is External/In production. Privacy copy and picker messages cover all 12 supported languages.

## Verification on 5 November 2026

- `npm test`: 494 passed, 0 failed.
- `npm run build`: passed, including type checking, lint and the programmatic SEO runtime gate. Four existing lint warnings remain in Compress PDF, Crop PDF and PDF to JPG.
- Production build served on `127.0.0.1:3155` in Chrome.
- Official Google Picker: searched for and selected the approved private test file `PDFPilot QA Google Drive.pdf`; PDFPilot imported its one page (13.25 KB).
- Official Dropbox Chooser from the workspace add menu: selected `PDFPilot QA Dropbox.pdf`; PDFPilot imported its two pages (2.96 KB).
- Combined the two imported files and downloaded `merged.pdf` (14,552 bytes). Reopened the saved bytes with PDF-lib: three pages, each 612 × 792 points.
- Start over restored the intake screen. Cancelling a Dropbox selection through PDFPilot restored enabled provider buttons without opening a local file dialog.
- Initial local browser runs intermittently stalled while loading the Google iframe. The final production-build run above completed sign-in, file selection, import and download. Do not interpret this as coverage of every browser or account configuration.
- Poper Blocker was disabled only for the approved local test origin and re-enabled after the account-picker checks.

Automated picker cases cover fixed download destinations, token handling, native Sheets export, invalid formats, denied downloads, oversize and empty responses, aborts, atomic batches, SDK click timing and closed popups. They do not substitute for provider service availability or account-specific checks. Mobile picker end-to-end verification remains outside this completed browser sample.

The capability source fingerprints were refreshed after reviewing the changed intake files; their processing logic and prior review dates were preserved. This does not assert new processing coverage for every affected tool.

## Sitemap state

The live sitemap set contains 8,964 unique page URLs across 25 XML files. The main index was resubmitted to Search Console successfully with zero reported sitemap errors. Sitemap submission is not evidence that every URL is indexed or ranked.
