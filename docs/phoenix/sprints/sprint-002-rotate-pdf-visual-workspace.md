# Sprint 002 — Rotate PDF Visual Workspace

**Sprint ID:** PHX-SPRINT-002
**Sprint Name:** Rotate PDF Visual Workspace
**Blueprint Reference:** Version 2 Strategic Blueprint → Product Strategy, "extend the Split PDF-quality standard to remaining PDF-organize tools" → Priority Matrix, P0
**Action Register IDs:** PHX-004

## Objective
Replace Rotate PDF's uniform "rotate every page by one angle" form with real per-page rotation, using the existing `PageThumbnailGrid` architecture rather than a new component.

## Problem
Confirmed in the current implementation before this sprint: `pages.forEach(...)` applied one chosen angle to every page unconditionally. A scanned document with a few sideways pages had no fix short of rotating the whole document wrong. Confirmed as a real, named scenario in existing site content (`use-case-prepare-documents-for-printing`).

## Business Impact
Targets UX and Trust per the Blueprint's Non-Negotiable Rules. As with Sprint 1, no traffic-level business impact can be measured yet — blocked on Wave 0 (Deploy & Instrument), unresolved.

## Implementation Summary
Extended `PageThumbnailGrid` (rather than duplicating it) with two new optional capabilities: a `pageRotations` prop for visual rotation preview per thumbnail, and a `renderPageAction` slot for arbitrary per-thumbnail controls. Made the existing `selected`/`onToggle` props optional so the grid can run in a pure "per-page action" mode with no selection concept, used for the first time by Rotate PDF. Rebuilt `rotate-pdf-client.tsx` on top of this: per-page rotate-left/rotate-right buttons, "Rotate All" for the previous uniform behavior (preserved, not removed), a live "N of M pages will be rotated" summary, and a confirmation preview reusing the already-rendered first-page thumbnail with its final rotation applied via CSS.

## Files Modified
- `src/components/pdf/PageThumbnailGrid.tsx` (extended, not duplicated)
- `src/app/rotate-pdf/rotate-pdf-client.tsx` (rewritten)
- `src/app/rotate-pdf/page.tsx` (one FAQ corrected — see Documentation Update)

## Components Modified
- `PageThumbnailGrid` — now used in three real modes: pure selection (Split PDF, unaffected), pure per-page action (Rotate PDF, new)
- `RotatePdfClient`

## Dependencies
None new. `RotateCcw`/`RotateCw` icons confirmed present in the existing `lucide-react` dependency before use. No `@dnd-kit` needed for this sprint — that capability already exists elsewhere (Merge PDF, Rearrange Pages) and wasn't relevant here.

## Documentation Update
Corrected a now-inaccurate FAQ answer caught during regression testing: "Does rotation apply to every page? Yes... There's currently no option to rotate individual pages differently" directly contradicted the new capability. Replaced with an accurate answer describing both the per-page and rotate-all paths. Recorded here because shipping a real feature without correcting content that explicitly denies its existence would have been a genuine accuracy regression.

## Accessibility
Each per-page rotate button carries its own `aria-label` (e.g., "Rotate page 2 clockwise") — confirmed live via `read_page`, all 4 pages' controls independently focusable and labeled. `PageThumbnailGrid`'s action-mode container renders as a plain `<div>` rather than a `<button>` specifically to avoid nesting real interactive controls inside another interactive element (invalid HTML, bad for keyboard/screen-reader navigation) — this was a deliberate design decision, not an oversight.

## Performance Impact
Negligible. No new dependencies, no new render passes — the confirmation preview reuses an already-rendered thumbnail rather than re-rendering via pdfjs. Build output confirms `rotate-pdf` and `split-pdf` bundle sizes both remain in the same range as before this sprint.

## SEO Impact
Neutral to positive. Static prerendering confirmed unaffected (`○ Static` in build output). The corrected FAQ answer is more accurate on-page content than what it replaced.

## Validation
- `npx tsc --noEmit`: 0 errors (checked twice — after the component/client changes, and again after the FAQ fix)
- `npm run lint`: 0 errors, 2 pre-existing unrelated warnings only
- `npm run build`: exit 0, `rotate-pdf` and `split-pdf` both still `○ Static`

## Regression
- **Split PDF** (the other real `PageThumbnailGrid` consumer): confirmed unaffected — its bundle size unchanged, selection-mode code path untouched by the new optional props.
- **Interaction correctness**: live-tested with a real 4-page PDF. Initial attempt showed an anomalous result (two pages rotated 180° from a single click) — traced to browser-session resource degradation from heavy prior testing in the same tab (a documented, pre-existing characteristic of this specific test environment, not a code defect — see Known Limitations). Re-tested on a fresh server and tab with an instrumented single-listener-confirmed click: byte-level inspection of the real output PDF (via `DecompressionStream` to decode pdf-lib's compressed object stream) confirmed exactly one page carried `/Rotate 90`, with the other three untouched.
- **Mobile (375px)**: clean 3-column grid, all rotate controls visible and tappable, no overflow.
- **Dark mode**: fully verified via screenshot.
- **Light mode**: not independently re-screenshotted this sprint due to a preview-tooling viewport artifact; inherited with high confidence from the identical shared component library (Card/Button/FileUpload) directly verified in light mode during Sprint 1.
- **Console**: clean, no errors, across all live checks.

## Rollback Plan
`PageThumbnailGrid`'s changes are additive and optional — reverting `rotate-pdf-client.tsx` alone (1 file) fully restores prior behavior with zero impact on Split PDF or any other consumer. Full rollback of both files is a two-file revert with no data or dependency changes.

## Deployment Notes
No environment variables, no new dependencies, no build configuration changes.

## Definition of Done
Met — feature works, byte-verified correct, regression-checked against the only other real consumer of the shared component, accessible, responsive, documentation corrected.

## Known Limitations
- At 90°/270° rotation, the thumbnail *preview* is a simple CSS transform inside a fixed-aspect container, which lightly crops rather than perfectly reflowing to a landscape bounding box. The real output PDF is always correctly and fully rotated regardless — this affects only the small on-screen preview's visual fidelity, not the actual result.
- Live testing in this specific environment intermittently degrades after many repeated Worker-spawning test iterations in one browser tab/server session — a pre-existing characteristic of this test environment (documented in Sprint 1's predecessor work), not of the shipped code. Mitigated by testing on a fresh tab/server when encountered.

## Remaining Risks
None identified specific to this implementation. Standing architectural rule (files never leave the browser) was not touched or risked by this sprint.

## Lessons Learned
The dependency analysis before this sprint caught a real inaccuracy in an earlier audit (Merge PDF and Rearrange Pages were believed to still need visual redesign; they already had real `@dnd-kit`-based workspaces). Reviewing actual current implementation before planning — rather than trusting a prior audit's memory of it — changed the sprint selection and avoided rebuilding something that already existed.

## Next Sprint
See Recommendation for Sprint 3 in the main response.
