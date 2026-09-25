# PowerPoint browser converter regression check

Local regression checkpoint on 2026-09-25, before deployment. The later scoped release authorization and verification are recorded in `three-tool-growth-2026-09-25.md` and the project-root release receipt.

## Fixes

- Result recommendations use theme surfaces and readable foreground colors, including Word/PPT completion screens.
- Office controls no longer sit in a fixed-height panel that cuts off its action. Add-file controls have dark-mode contrast and a centred tooltip.
- PPTX custom paths, lines, grouped coordinate transforms, rotation, image cropping, table columns, and embedded raster images are rendered instead of discarded. Image signatures are read even when Office names a PNG `.tmp`.
- Drawing guides are evaluated on demand; unused invalid connector metadata cannot discard a valid slide.
- ZIP expansion is validated before decompression. Work is batched to limit worker allocation, and slides are parsed individually to limit live DOM memory.
- Real converter progress reaches the UI. Cancelling and restarting does not revive a stale conversion.
- Output names keep the full title, remove Office extensions/trailing dots, and are collision-safe in batch ZIPs.

## Verification

- `node --test tests/*.test.cjs tests/*.test.mjs`: **34 passed**.
- `npm run build`: passed compilation, lint, type checks and static generation.
- Owner-provided 40.13 MiB technical drawing presentation: **75 output pages**, **36.99 MiB**, approximately **24.6 seconds** in local headless Chrome with the production build. This is a local measurement, not a speed guarantee for other devices.
- Output contains 6,892 unique embedded images (old output: 6,891) and 321,267 path move operations (old: 18,481). These counts demonstrate restored content; they are not a pixel-fidelity score.
- All 75 pages rendered and inspected in contact sheets. Selected cover/register/drawing pages inspected at larger scale; locally generated LibreOffice reference used for comparison. That reference also substitutes fonts, so it is not a Microsoft PowerPoint fidelity certification.
- Synthetic fixture: explicit fills/borders, rotated ellipse, rotated two-color picture, multiline text, unequal table columns and rows rendered successfully.
- Unsupported visible shape: persistent slide-specific error; no incomplete PDF offered as a successful result.
- Batch containing three identical filenames: `basic.pdf`, `basic-2.pdf`, `basic-3.pdf` retained.
- Light/dark result links readable; 390px mobile result had no horizontal overflow; no browser runtime errors or POST requests during synthetic conversion.
- Existing shared-workspace/language, Word-to-PDF, and spreadsheet regressions passed. This is not a fresh end-to-end conversion test of all 26 tools.

Private source files, PDF outputs, and screenshots were kept outside the repository.

## Reproduce

```sh
node scripts/create-pptx-pdf-fixtures.cjs
node --test tests/*.test.cjs tests/*.test.mjs
npm run build
npm run start -- --hostname 127.0.0.1 --port 4330
```

Open `/powerpoint-to-pdf`, select the generated `basic.pptx`, check both themes, convert and inspect both PDF pages. Repeat with `unsupported-shape.pptx`: conversion must stop with a clear error. Add `basic.pptx` three times and check the ZIP has three different filenames. Cancel a large conversion, restart, and check that only the active job produces a download.

## Limits

Browser-only rendering is not the Microsoft PowerPoint engine. Exact fonts, text wrapping, theme effects, complex table styles and every Office feature are not guaranteed. Supported elements improve substantially, but this must not be described as universal pixel-perfect conversion. Charts, SmartArt, unsupported geometry/image formats, linked external images, unsupported fills and missing font glyphs fail explicitly. Animations/video playback are not reproduced in this static PDF conversion. For exact PowerPoint appearance, use PowerPoint's own PDF export. No conversion server or upload fallback was added.

## Manual production deployment

Run from this worktree, not the separate `main` worktree. It is already linked to the existing `pdfpilot` Vercel project. No branch checkout or merge is needed for a local prebuilt deployment.

```sh
cd "/Users/apple/Documents/Claude/Projects/PDF Pilot/launch-catalog" &&
npx --yes vercel pull --yes --environment=production &&
npx --yes vercel build --prod &&
npx --yes vercel deploy --prebuilt --prod
```

This manual deployment does not commit or push source changes to GitHub. Synchronize source separately before a future Git-triggered release, or that release could restore older code. SEO/automatic jobs were not changed.
