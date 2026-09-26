# PDF Pilot: task-based programmatic SEO

## Approved direction — 26 September 2026

The user-supplied `PDF-Pilot-Template-Preview.html` and four screenshots are the design reference. This batch implements its six pages in the existing Next.js site. The HTML contains the complete examples; the referenced ZIP was not supplied.

### Design lock

- Paper `#f7f9f5`, ink `#152e2b`, muted `#526663`, teal `#176953`, mint `#e5f0e9`, border `#d5e0d9`.
- System sans, strong tightly spaced headings, 67px desktop / 43px mobile hero.
- 1152px content width, spacious two-column hero, white tool card, restrained borders and 20px corners.
- Numbered steps, a practical table or distinct task guidance, interactive review checklist, native FAQ disclosures, related workflow cards.
- Dark green upload-size planner; guide-specific contents navigation and vertical reading layout.
- Existing site navigation and actual processing workspace remain integrated. Mobile stacks at 680px; visible focus and reduced motion supported.

## Routes and ownership

| Family | Canonical URL | Action |
| --- | --- | --- |
| Library | `/use-cases` | New browseable entry point |
| Tool | `/compress-pdf` | Reference landing at the existing URL |
| Tool | `/merge-pdf` | Reference landing at the existing URL |
| Task | `/use-cases/compress-pdf-for-upload` | Planner, connected compression, upload review |
| Task | `/use-cases/merge-pdf-for-application` | Submission map, connected merge, packet review |
| Guide | `/guides/why-pdf-still-too-large` | Actual compression behavior and next action |
| Guide | `/guides/check-merged-pdf` | Page-count example, section audit, connected merge |

Existing document templates, conversion presets, two-step workflows and localized tools retain their URLs. The two existing English core URLs are reused to avoid competing copies.

## Add a page from keyword data

1. Group queries by the job to be done and compare with all existing tool, guide and use-case URLs. Upgrade an existing intent when it already answers that job.
2. Confirm the task can be completed with a supported tool. Record its actual limits and output behavior.
3. Add a typed row in `src/lib/content/pdf-intents.ts`, initially `status: "draft"`. This automatically supplies the route, metadata, content sections and interactions. A draft has noindex and is excluded from the library, search and sitemap.
4. Supply original task instructions, useful examples, output checks and contextual FAQs. Do not publish keyword substitutions of the same page. No demand/volume claims are inferred without the user's data.
5. Link the page to related published intents. Validate content, accessibility, file processing and metadata; then set `status: "published"` and make it reachable from a related page. Build validation rejects broken links and published links to drafts.
6. Review Search Console impressions/clicks and GA4 landings/processing completions by canonical path. Future keyword data is expected in the next chat; no rankings or traffic volumes are promised.

Rendering: `IntentPage.tsx` is a shared server component, with small client interactions. It passes the rendered content to a landing slot in the existing compression/merge clients. Selecting PDFs opens the existing workspace on the same URL, including its validation, cancellation and download flows.

Compression guard verified from `src/lib/engines/pdf-compress-engine.ts`: if the rebuilt **whole file** is not smaller, the original bytes are returned. Rebuilt PDFs lose selectable text. The planner is arithmetic, not exact-size compression. It converts KB/MB/MiB before comparing values.

Analytics: `pdf_workflow_opened` and `pdf_workflow_started` carry fixed catalog identifiers only. Existing `tool_conversion_completed` events record processing completion on the current page. Planner values, checklist selections and filenames are not added to these events.

Search guidance used: [Google's canonical URL documentation](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) and [scaled content policy](https://developers.google.com/search/docs/essentials/spam-policies#scaled-content). The site provides usable tools and task-specific value; publication itself does not establish indexing or ranking.
