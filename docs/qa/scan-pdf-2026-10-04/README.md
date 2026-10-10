# Scan PDF candidate evidence — 4 October 2026

D branch `codex/product-scan-2026-10-04`, base `3e92891a1d15821cfab7a204f65c097ccd9fdb45`. Parent-owned camera header commit `7cc551cd` applied locally as `544d2fc`; D must not re-own configuration.

## Bounded requirement

Existing public `scan-pdf`: import JPG/PNG or capture a camera image only after an explicit action, keep processing local, validate the existing 100 MB per-image limit, preview/read failures, add/remove/order/rotate scans, choose A4/Letter/Fit, portrait/landscape and margin, export an ordered multi-page PDF or separate PDFs in ZIP, inspect/download/reset/retry/cancel. Cropping and scan filters were not present and are not claimed by this slice. Preserve the intended phone-to-desktop handoff as an unfinished requirement; no file transfer or provider is introduced.

## Observed current product and reference

Read-only primary reference observed through the browser: https://www.ilovepdf.com/scan-pdf — actual first-step QR, second-step disconnected state, follow mobile instructions and save, keep desktop tab open. No assets or branding copied. The web search connector did not retrieve the reference reliably; the actual browser observation is the evidence.

Production https://pdfpilot.net/scan-pdf was observed before edits: decorative 9×9 QR; adding two synthetic PNGs exposed rotation/remove but no ordering controls; Show QR produced only the toast “Use camera or upload scans from your device.” Basic Save to PDF reached result. Download retrieval through the browser tool timed out, so this baseline is not output certification. Existing public metadata/help says camera is disabled, while UI still offers Use camera through a capture file picker.

An engine regression reproduced a real data-loss bug: separate output for `scan.png`, `scan.png`, `scan-2.png` returns only two ZIP entries. The fix selects unused output names globally, preserving all three PDFs. Unit tests also render real PDF output to check selected page order, clockwise rotation of an asymmetric marker, landscape Letter page dimensions, cancellation, malformed-image error and valid retry.

## Current implementation (not yet released)

- Preserves image upload/camera file-input fallback and all existing output options; adds real earlier/later order controls.
- Validates type, empty files and 100 MB limit on every input path, including camera fallback. Broken preview disables Save and explains replacement; processing failures are visible and retryable.
- Uses existing PDFPilot workspace/result components, neutral primary action with orange accents, responsive action near the top, and fits rotated previews without clipping.
- Camera dialog requests video only after Use camera, no audio. Capture uses a local canvas and returns a JPG to the same scan queue. Denial/no device/failure have retry and file-picker fallback; closing/unmounting/stale permission responses stop tracks. No permission is requested on page load.
- A scanner reached through Next client navigation can inherit the previous document's `camera=()` policy. The dialog detects this and offers a same-origin scanner link in a fresh tab; existing scans are retained in the original tab. It does not reload away user work or prompt automatically in the new tab.
- The fake QR is replaced in this proposal with an explicit phone-transfer-unavailable notice. Phone-to-desktop transfer is still incomplete and is not counted as delivered. Parent must review the proposal before release. No fresh-scanner QR is misrepresented as transfer.

## Checks so far

- New scan engine + parent policy regressions: 4/4 pass.
- `npm run typecheck`: pass after the final client edits. Parent combined build and production acceptance remain required.
- Repository `npm run lint -- --file src/app/scan-pdf/scan-pdf-client.tsx --file src/lib/engines/jpg-to-pdf-engine.ts`: pass.
- `scripts/check-scan-browser.cjs`: local Chromium acceptance passed against port 4404, using `--use-fake-device-for-media-stream`, no physical camera. Real uploads/downloads, ordering/rotation/Letter/margin controls, reset, malformed replacement, separate ZIP collision handling, long Unicode filename, mobile top action, no overflow at 375/768/1440, actual theme toggles and `html.dark` assertion.
- Camera: no stream on initial load; click-driven capture created a real one-page PDF; closing stopped tracks; explicit denial displayed retry/fallback; Next home-to-scan navigation retained denial and safely reopened a fresh scanner tab with no automatic capture. Camera output was rendered and visually inspected: the synthetic green frame and its timer/shape remained visible. No native camera certification is claimed.
- Ordered downloaded PDF rendered through PDF.js: 2 pages, landscape Letter 792×612 points, blue then red center pixels, rotated black corner marker at the expected coordinate. Separate ZIP holds 3 parseable one-page PDFs for the colliding input names. Engine tests also verify cancellation returns no output and valid retry after malformed input.
- Browser recorded zero page errors and zero POST requests. The dev-only `/__nextjs_original-stack-frames` endpoint is excluded by the harness if present; none were reported in the passing evidence.
- Screenshots inspected: initial, 375/768/1440 workspace light/dark, result, malformed input, synthetic camera capture, 375px permission denial and long filename. Captures disable finite CSS animations and wait two repaint frames after resizing to avoid transient screenshots. Earlier harness-only issues were initial hydration timing and a wrong CDP permission descriptor; final run passed.
- All D browser instances and dev server were stopped; E received the next serial browser slot.

Evidence is under `docs/qa/scan-pdf-2026-10-04/browser/`: `report.json`, `ordered.pdf`, `separate.zip`, `synthetic-camera.pdf`, `synthetic-camera-render.png`, and named screenshots. Generated binaries remain local artifacts; the report and reproducible harness are versioned. Re-run with `PDFPILOT_PLAYWRIGHT_MODULE` pointing to an installed Playwright module and optionally `PDFPILOT_CHROME` to Chrome, then `node scripts/check-scan-browser.cjs http://127.0.0.1:4404`. No Playwright dependency is added to the product.

The parent owns the pending help/capability text correction: remove the obsolete claim that camera is always disabled, retain browser permission/fallback limits, and explicitly keep phone transfer unfinished. No production availability/completion increment is claimed by this candidate.

## Transfer decision still required

The repository has no peer signaling or temporary transfer storage. Genuine automatic phone-to-desktop delivery needs an explicit architecture/privacy review: an owned signaling path with direct peer transfer and network compatibility handling, or a disclosed temporary relay/storage path with authorization, expiration and size/rate limits. No new provider, cost or server file processing is authorized or implemented in this slice. Scan remains unfinished while this requirement remains open.
