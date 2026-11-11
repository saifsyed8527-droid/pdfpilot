# iLovePDF language parity preview

The live benchmark on 11 November lists 26 languages. PDF Pilot already serves 12. Fourteen additional language dictionaries and route metadata are now implemented locally for all 109 tool names/descriptions, shared navigation, home/core-tool copy, upload/picker feedback and related workflow labels. 545 public source strings per language; 7,630 draft translations in total. No uploaded user document was sent for translation.

Run `NEXT_PUBLIC_PREVIEW_LOCALES=1 npm run dev -- --port 4367` for local review. The new locales are inactive without the preview flag; preview routes are noindex and excluded from search alternates and sitemaps. Resources and integrations without complete translations link back to their existing English URLs. Existing production locales retain their current behavior.

This is not complete language parity: tool-specific controls and errors contain English, and native-language and full functional QA are pending. Do not remove the preview/indexing gates or publish these dictionaries until the developer checklist passes. Translating tool names alone is not a completed tool translation.

Added: Italian, Traditional Chinese, Bulgarian, Catalan, Dutch, Greek, Malay, Polish, Swedish, Thai, Turkish, Ukrainian, Vietnamese and Swahili. Portuguese maps to the existing pt-BR implementation; this does not claim a separate European-Portuguese edition.

Evidence lives in the project outputs/technical-seo-2026-11-11 folder. The separate sitemap/schema release contains none of these language drafts.
