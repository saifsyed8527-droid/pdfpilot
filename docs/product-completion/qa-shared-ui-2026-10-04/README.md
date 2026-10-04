# Shared interface baseline and first correction

Branch: `codex/product-a-2026-10-04`. Base `3c4b879`. Reference source content derives from `87a66ce`. Agent A changed no tool client, engine, route, registry, gate, dependency or configuration.

## Delivered

- `44d1b0b`: `TextToolWorkspace` / `TextToolPanel`, requested by E for its four encoder clients. Presentation-only shell uses existing workspace bar, slate/dark surfaces, FAQ and related content. Tool clients retain state and task controls.
- `5f8c937`: `PdfToolChrome.tsx` correction: long filename metadata wraps; toolbar actions can wrap; the add-button tooltip aligns inward on pointer/focus instead of extending past the screen. Includes the UI contract.
- Final evidence commit: this folder, synthetic fixtures and clarified contract coverage.

## What actually ran

`npm run typecheck` passed after the text workspace addition. The subsequent typecheck after the chrome patch was stopped at the parent's request to free memory; it has no pass/fail result.

`node docs/product-completion/qa-shared-ui-2026-10-04/capture-baseline.cjs` opened an independent headless installed Chrome on `http://127.0.0.1:4401`. Only synthetic fixtures were selected. Merge and Split each exercised initial input, loaded files/settings, actual conversion and automatic download, reset, malformed input and long filenames. Captured widths 375, 768 and 1440 in light/dark are emulated desktop viewports, not native-device certification.

| Tool | Actual downloaded output | Browser runtime errors | Reset |
| --- | --- | --- | --- |
| Merge PDF | `merged.pdf`, 1285 bytes; parsed 3 pages from 2-page alpha + 1-page beta | None | Returned to upload screen |
| Split PDF | `alpha_range_1.pdf`, 1073 bytes; parsed 2 pages using default full-document range | None | Returned to upload screen |

These page-count checks are visual-run support, not complete content/layout certification. F owns independent production output checks. No release or production-completion claim is made by A.

62 raw screenshots and `baseline/report.json` were created. Only selected representative images are committed. Visual inspection found important harness limits: screenshots named `processing` actually show the final result because the small files completed before capture. Early 375px loaded/error shots can still show pending thumbnails; the 1440px error shots show settled malformed-PDF errors. Those transient screenshots are not accepted processing/error evidence. The script has subsequently been tightened to wait for thumbnails and specific error messages, and record the actual processing status; that tightening has not been rerun.

Compress route compilation took 115 seconds under concurrent development-server load; the initial run then stopped before Compress/PowerPoint capture. A's targeted `verify-overflow.cjs` did not reach a page: localhost navigation timed out after 120 seconds. At the parent's instruction, A stopped server 4401 and the pending typecheck; no 4401 listening socket remained. Combined candidate browser/type/build checks must verify the chrome fix.

## Reproduced findings

1. **Shared add tooltip:** Merge document width was 778px at a 768px viewport in both themes. The invisible centered tooltip caused it. C independently reproduced 784px at 768px in PDF to Word. Fixed in `5f8c937`, awaiting combined browser regression.
2. **Shared metadata:** Split's 216-character unbroken filename yielded a 1383px document width at 375/768. Fixed in `5f8c937`, awaiting combined browser regression.
3. **Client action placement:** at 375x960 the Merge action began at y1180 and Split at y1161, below the initial viewport. B was informed; A did not rewrite either reference client.
4. **Remaining shared question:** long result filenames still need browser coverage before changing `ResultState`; this was not silently treated as a proved defect.

Representative evidence:

- [Merge initial, 375 light](baseline/merge-pdf-initial-375-light.png)
- [Merge loaded, 1440 dark](baseline/merge-pdf-loaded-1440-dark.png)
- [Merge settled input error, 1440 dark](baseline/merge-pdf-error-1440-dark.png)
- [Split loaded, 768 dark](baseline/split-pdf-loaded-768-dark.png)
- [Split settled input error, 1440 dark](baseline/split-pdf-error-1440-dark.png)
- [Split long-name overflow, 375 light](baseline/split-pdf-long-filename-375-light.png)
- [Split result, 375 light](baseline/split-pdf-result-375-light.png)
- [Measured report](baseline/report.json)

## Exact next checks

On the combined candidate, run `PDFPILOT_QA_BASE=http://127.0.0.1:<port> node docs/product-completion/qa-shared-ui-2026-10-04/verify-overflow.cjs`. It asserts no document overflow for Merge's hovered/focused tooltip and Split's long metadata at all six viewport/theme combinations. Also check Office's bottom/left add-button tooltip, and C's PDF-to-Word top/right replace button. Complete Compress/PowerPoint visual baseline in the shared browser run, inspect real processing and error states, then recheck all four references after deployment.

All raw evidence remains in this worktree. Omitted PNGs are ignored only to avoid adding redundant megabytes to the release commit; they were not deleted.
