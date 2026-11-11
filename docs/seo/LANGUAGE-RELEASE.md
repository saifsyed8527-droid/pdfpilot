# iLovePDF language parity release

Benchmark checked 11 November 2026: https://www.ilovepdf.com/ lists 26 languages. This release adds Italian, Traditional Chinese, Bulgarian, Catalan, Dutch, Greek, Malay, Polish, Swedish, Thai, Turkish, Ukrainian, Vietnamese and Swahili to the 12 existing languages.

Each added language has a homepage and all 109 real tool workspaces: 1,540 new canonical URLs. Tool and homepage metadata, language search, canonical URLs, 26 reciprocal language alternates plus x-default, and localized tool schemas are included. New languages use their locale prefix and stable tool slug. Portuguese uses the existing pt-BR implementation; a separate Portugal edition is not claimed.

The existing components, layout classes, file-control values and processing engines are reused. Authored controls, options, error and completion messages use server-selected offline dictionaries; interpolation preserves filenames and document values. There are 545 shared-copy entries and 3,702 additional workspace dictionary entries per new language. Dictionary entries overlap shared copy. No user documents are sent for interface translation and there is no runtime translation service. Unknown library diagnostics retain their original technical details.

Resources and integration articles without these translations continue to link to existing English pages, and are excluded from the new languages' hreflang and sitemap. Existing resource languages remain supported. Root robots.txt continues to advertise the authoritative /sitemap.xml index. Its child URL sitemaps retain existing unique URLs and add only the new language home/tool pages.

Validation: npm test, npm run check:seo, npm run typecheck, npm run build; route and schema audit; native-name search; real browser upload/download, invalid input and recovery; mobile overflow; post-release HTML and sitemap checks. Checks do not constitute native-speaker certification or prove every possible input works. Interface translations are assisted translations with terminology, placeholders, route and functional checks.

Evidence in the private project outputs/international-release-2026-11-11 folder records exact commands, results and deployment state. The tracker records release separately from Search Console submission and indexing. No new keyword landing pages, paid hosting or background watcher is introduced.
