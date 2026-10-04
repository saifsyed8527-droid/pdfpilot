# PDFPilot tool interface contract

Baseline: `3c4b879`, preserving application source from `87a66ce`. Owner A writes `src/components/tool/**`, excluding C-owned `OfficeToPdfWorkspace.tsx`. Existing category accents are part of the approved implementation: Merge/Split/PowerPoint use orange, Compress uses emerald, and amber remains the conversion/utility accent. Do not recolor all tools to the same accent.

## Shared building blocks

| Component | Contract |
| --- | --- |
| `PdfToolLanding` | File-first input only. Localized title/description, max-width 5xl, 4xl/5xl title, rounded dashed upload card, keyboard/drop input, supported formats, truthful limits/privacy. Pass existing category icon/accent. |
| `PdfWorkspaceBar` | One tool h1 (h2 when embedded), localized home link, responsive metadata, optional action group. File names and actions must fit at 375px. |
| `PdfAddButton` | Named, keyboard-operable add/replace action. Only show a count when meaningful. Preserve existing disabled/tooltip behavior. |
| `ProcessingState` | Actual processing label/progress. Expose cancel only when it genuinely stops/discards the operation. Client/engine owns progress and cancellation. |
| `PdfToolResultLayout` | Max-width 4xl, rounded-3xl white/slate-900 result surface. Existing related/trust components remain. |
| `ResultState` | Filename, size, successful output download and reset. The caller owns the actual bytes, download callback and stable auto-download ref. |
| `OfficeToPdfWorkspace` | C-owned batch/order/rotate/selection workflow. Preserve actual Office options and accurate fidelity explanation. |
| `TextToolWorkspace` / `TextToolPanel` | Text/table-first utilities: use the same workspace bar, slate background and rounded-3xl surfaces around task-appropriate editors. No forced PDF cards/upload step. All processing and controls remain with the tool owner. |

`TextToolWorkspace` props: `title: string`, `description: ReactNode`, optional `meta`, `actions`, `faqs: FaqInput[]`, `related: ResolvedEntity[]`, and required `children`. `TextToolPanel`: `title: string`, optional `description`, `className`, and `children`. FAQ answers and existing related content are retained.

## Visual and interaction requirements

- Reuse slate text/background tokens, current fonts, amber/category accents, existing Lucide icons and neutral primary actions. Document previews remain white in dark mode.
- Desktop document workspace is at most 1500px, with previews and a 380–400px settings region where appropriate. Editors/tables may use a different arrangement within the same surfaces.
- At 375/768px, retain a clear primary action near the top; do not let a tall preview/file list hide it. Keep desktop reference arrangement unless a defect warrants a narrow fix.
- Every visible control must affect real behavior. Preserve existing add/remove/order/rotation/selection controls relevant to the tool. Use text editors for formatters and tables for structured data.
- Wrap long unbroken filenames/error text; constrain tables/editor scrolling to their panel. Metadata, offscreen tooltips and icons must not widen the document.
- Give buttons/inputs accessible names and visible keyboard focus. Disable conflicting actions during processing. Error messages stay visible with an enabled route to replace input/retry/reset.
- On results, download/copy and reset remain reachable. Do not automatically repeat downloads after unrelated rerenders. Reset clears the prior file/result/error appropriately.
- Preserve existing translated content, navigation, FAQ, analytics and privacy semantics. New controls must not upload files to another provider.

## Baseline and acceptance evidence

Reproducible script: `docs/product-completion/qa-shared-ui-2026-10-04/capture-baseline.cjs`. It opens an independent headless Chrome process against `http://127.0.0.1:4401`; only synthetic fixtures are used. Widths 375, 768 and 1440 are desktop browser viewport emulation, not native-device certification. Light/dark are explicit root theme classes. Processing capture uses CPU throttling, never mock processing or injected delays. A transient state is recorded as uncaptured when it cannot be observed.

The script supports initial, loaded, processing where observable, result, malformed-input error, reset and long filename states for all four reference tools. The completed A baseline covers `/merge-pdf` and `/split-pdf`; Compress compilation stalled before capture, and PowerPoint was not reached. F owns independent production content/layout verification for all four references. Output parsing in A's visual run checks PDF page counts. Reports include measured document width, actions/disabled states, visible headings and browser errors. Raw screenshots remain in the mission evidence directory; representative images are linked in its README.

Known reproduced baseline findings and corrections are recorded in `qa-shared-ui-2026-10-04/README.md`; baseline appearance is not an assertion of complete tool readiness.
