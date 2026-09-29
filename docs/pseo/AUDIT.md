# Repository audit — 28 September 2026

Baseline: local `origin/main` commit `fdad687` in `pseo-engine`, isolated on `codex/pseo-engine`. The workspace's managed checkout tool could not operate because the project root contains repositories rather than being one itself; a standard Git worktree was created instead. Nothing was pushed or deployed.

The separately active `launch-catalog` checkout contains an ongoing 89-task implementation and competitor CSV intake. It was inspected read-only, not overwritten, imported as new research, or treated as production. This framework builds on the available production baseline and does not include those uncommitted pages or their new compression runner. Integrating the two branches later requires deliberate reconciliation of capability changes and their evidence, not blind copying or a second writer for the new manifest.

| Existing implementation | Decision | Reason |
|---|---|---|
| Next.js 15.5.24, React 19, App Router, npm | KEEP | Existing framework and build conventions are suitable. |
| Launch catalog with exactly 26 public tools | REUSE | Explicit public scope already exists independently of the larger registry. |
| Original clients, engines, worker conversion paths | KEEP | Existing functionality remains the executable source of truth. |
| Per-tool `ToolWorkspace` exports and their full clients | REUSE | The original full client powers each intent; a client lazy boundary selects one. Core wrappers retain their behavior. |
| Localized root catch-all resolver | IMPROVE | Split the optional root boundary into `[locale]/page.tsx` and nested `[...slug]`; all old URLs remain intact and unrelated tool bundles stay off intent pages. |
| Core metadata, locale canonicals, hreflang | KEEP | Existing important URLs and translations retain ownership. |
| Document templates and conversion presets | KEEP | Independent useful product features, not substitutes for tool-intent pages. |
| Six workflow pages and engines | KEEP | No speculative multi-tool expansion. |
| Existing `/pdf-workflows` hub | IMPROVE | Add approved task discovery with server-side search and pagination. |
| `ToolGrowthLinks`, `ConversionDetails`, homepage search | REUSE/IMPROVE | Connect approved task pages without expanding the header/footer. |
| Existing sitemap and robots | IMPROVE | Preserve core/content sitemap; announce derived segmented pSEO sitemaps when nonempty. |
| Zod content catalogs, CLI TypeScript loading approach | REUSE | Validated data-driven content and offline scripts fit this repository. |
| Existing GA sender and content events | REUSE | New page attribution without replacing analytics or passing file data. |
| Existing theme/navigation/layout | KEEP/IMPROVE | Presentation context changes only headings; reuse the inspected keyed-fragment streaming fix from the earlier local pSEO work. |
| Existing tests, samples and browser automation conventions | REUSE | Preserve regression suite and test real downloaded output. |
| One-off keyword generator in active `launch-catalog` | KEEP outside this branch | Not production and owned by another active chat. Its fixed export/matrix assumptions are not reused as this framework's importer. |
| Unreviewed arbitrary keyword pages, broad automatic format/device matrices | REJECT | Capabilities and useful distinct intent must justify each URL. |
| Deletion/replacement of existing pSEO or document-template code | NONE | No technically sound existing system was removed. |

Tool inspection distinguished source-level capabilities from measured browser/platform claims. Registry evidence includes each public client and relevant processing files or API routes, with hashes. A file picker accepting a format is required; hidden decoders alone do not establish support. Newly generated device pages require separate end-to-end evidence. No physical iPhone/Android verification is inferred from responsive screenshots.

The baseline production browser capture loaded all 26 tools with one H1, self-canonicals and upload controls (HTML uses its own Add HTML flow). Baseline runs exposed intermittent React hydration #418. The existing local keyed-fragment fix is reused without adding DOM wrappers or changing tool state. Before/after captures and the final measured results are recorded in the implementation report.
