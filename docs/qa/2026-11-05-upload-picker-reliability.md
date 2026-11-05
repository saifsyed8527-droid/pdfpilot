# Upload layout and cloud-picker follow-up

This follows the initial account-picker release. It preserves Merge/Split processing and navigation.

## Changes

- The shared intake uses a centered, bounded main button with two 36 px provider buttons beside it. The nested filled drop-zone cards are removed; drag/hover feedback remains. The workspace add-files menu retains its existing flow.
- Google browsing no longer filters entire folder contents by the tool's MIME types. `PickerBuilder.setSelectableMimeTypes` restricts selection instead. A separate Shared Drives view is available. The selected-file-only `drive.file` scope is unchanged.
- Cloud selection distinguishes SDK preparation, opening a window, choosing files and downloading. A delayed window offers Reopen and Cancel. Cancel closes provider UI when supported, settles the selection, and ignores stale callbacks. Status controls render above the Google dialog.
- Downloads time out after 20 seconds without response headers or 30 seconds without body progress. Progress resets the body deadline. Drive metadata is bounded to 64 KiB. Existing batch, file-type, size and destination checks remain.
- Status and recovery copy covers the 12 existing locales.

## Verified on 5 November 2026

- `npm test`: 500 passed, 0 failed.
- `npm run build`: passed, including type checking, lint and the programmatic SEO runtime gate. The four existing lint warnings remain.
- `git diff --check`: passed.
- Chrome, production build on `127.0.0.1:3155`: the main upload button measured 330 × 80 CSS pixels; cloud buttons measured 36 × 36. The main button is centered under the heading. English and Arabic desktop layouts were visually checked.
- Local alpha (2 pages) plus beta (1 page) were merged and downloaded. The saved bytes reopened as 3 pages, with text in the exact order `ALPHA PAGE ONE`, `ALPHA PAGE TWO`, `BETA PAGE ONE`.
- After the user paused Poper Blocker for this local origin, the official Dropbox Chooser opened, selected the approved `PDFPilot QA Dropbox.pdf`, and imported its two pages. It was combined with the local beta fixture and downloaded. The saved result was 2,824 bytes and three readable pages, with the Dropbox sample's two pages followed by `BETA PAGE ONE`.
- Local Start over, Google Cancel and recovery from a missing provider window restored the intake controls. The regression cases also cover delayed headers/body, cancellation during reads, stale callbacks, blocked popups, SDK cleanup errors, and Google picker selection configuration.

## Verification limits

- Google authenticated and created its dialog, but the embedded picker remained blank in this browser session. The same blank dialog reproduced on the existing live release before these changes. This follow-up therefore does **not** claim a successful real Google file import or visual confirmation of the new folder browsing behavior. The initial release's earlier successful Google sample remains documented separately.
- A metadata check of the reported Our Story folder found PNG images rather than PDFs, consistent with the old file filter hiding its contents. This does not establish the contents or cause for every other reported folder.
- The browser viewport override did not change the observed viewport; mobile layout and mobile account-picker behavior are not claimed as verified here.
- The user was asked to restore Poper Blocker after the local test because browser controls cannot access the extension setting. Do not treat a request as confirmation of restoration.

Google API references: [selection MIME types](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setselectablemimetypes), [Shared Drives view](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setenabledrives).
