# Sprint 001 — Trust Signal Elevation at Point of Upload

**Sprint ID:** PHX-SPRINT-001
**Sprint Name:** Trust Signal Elevation
**Blueprint Reference:** Version 2 Strategic Blueprint → Product Strategy, "surface the trust signal at the point of upload" → Priority Matrix, P0
**Action Register IDs:** PHX-003

## Objective
Move the verified-true "files never leave your browser" claim from FAQ text (two scrolls below the point of decision) to the point of upload itself, site-wide, with zero risk of the message drifting out of sync between tools.

## Problem
Confirmed across two audit passes (Product/UX Audit, Competitive Benchmark): the claim was real and accurate everywhere but stated only in FAQ copy. Adobe's live tool explicitly discloses its (server-side) upload behavior at the point of action; PDFPilot had the stronger underlying fact and the weaker delivery of it.

## Business Impact
Directly targets the Trust and Conversion dimensions named in the Blueprint's Non-Negotiable Rules. No measurable business impact can be reported yet — no live deployment or analytics connection exists (Blueprint Risk #1, unresolved). This sprint improves the mechanism; measuring its effect is blocked on Wave 0 (Deploy & Instrument), not on this sprint.

## Implementation Summary
Added a trust line — icon + real, accurate text — to the shared `FileUpload` component, placed below the existing dropzone copy, separated by a visual divider. Because all 89 tool-page consumers render this one component, every tool inherited the change with zero per-page edits.

## Files Modified
- `src/components/file-upload.tsx`

## Components Modified
- `FileUpload` (shared, 89 consumers, zero other files touched)

## Dependencies
`ShieldCheck` icon from the existing `lucide-react` dependency — confirmed present before use, no new package added.

## Accessibility
Icon marked `aria-hidden`; message conveyed by real text, not icon-only. Contrast verified in both themes via live screenshot.

## Performance Impact
Negligible. One icon import, a few lines of markup. Build output confirmed unchanged bundle sizes across affected routes.

## SEO Impact
Positive. Content is present in the statically pre-rendered HTML (confirmed via build output — every route remained `○ Static`), so this is real, crawlable on-page trust content, not a client-only visual flourish.

## Validation
- `npx tsc --noEmit`: 0 errors
- `npm run lint`: 0 errors (2 pre-existing, unrelated `<img>` warnings only)
- `npm run build`: exit 0, all routes still statically prerendered

## Regression
Live-checked: dark mode (Merge PDF, Split PDF), light mode (Split PDF), narrow two-column layout where the badge renders twice (JSON Diff), mobile viewport 375px (Split PDF), browser console (clean, no errors) across all checks.

## Rollback Plan
Single-file, single-component change with no schema, data, or dependency changes. Rollback is a revert of the one edit to `src/components/file-upload.tsx`; no cascading changes exist anywhere else in the codebase.

## Deployment Notes
No environment variables, no new dependencies, no build configuration changes. Safe to ship as part of any normal deploy.

## Definition of Done
Met — feature works, validated, regression-checked in both themes and at mobile width, documented.

## Known Limitations
At 375px mobile width, the icon sits at vertical-top rather than perfectly centered against the 3-line wrapped text. Cosmetic only; text remains fully legible.

## Remaining Risks
None identified for this specific change. The claim's real-world credibility still depends on the underlying zero-upload architecture continuing to hold true for every future tool — a standing architectural rule (Blueprint Trust Rule), not a risk introduced by this sprint.

## Lessons Learned
Site-wide UX/trust changes are cheapest and lowest-risk when the shared-component layer is used correctly — this shipped as a 1-file change covering 89 pages instead of 89 individual edits, with proportionally lower regression surface.

## Next Sprint
PHX-SPRINT-002 — see Dependency Analysis in the Action Register for tool selection reasoning.
