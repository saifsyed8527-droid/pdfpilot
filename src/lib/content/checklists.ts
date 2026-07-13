import type { BaseContentEntity, EntityRef } from "./types";

export interface ChecklistItem {
  text: string;
  tool?: EntityRef;
}

export interface ChecklistEntity extends BaseContentEntity {
  type: "checklist";
  items: ChecklistItem[];
}

/**
 * Backlink Asset Engine — Phase 3 Growth Engine. Checklists are a
 * genuinely real, honest asset format (unlike a "statistics page" or
 * "research page," which would need real data this project doesn't
 * have): every item below is a real, checkable step grounded in an
 * actual tool's actual behavior, not filler. One real example this
 * sprint, proving the content type — not a batch of speculative
 * checklists.
 */
export const CHECKLISTS: readonly ChecklistEntity[] = [
  {
    type: "checklist",
    id: "checklist-pdf-compression",
    slug: "pdf-compression-checklist",
    path: "/checklists/pdf-compression-checklist",
    title: "PDF Compression Checklist",
    description:
      "Before and after compressing a PDF, these are the things worth checking — grounded in exactly how PDFPilot's Compress PDF tool works, not generic advice.",
    searchIntent: "transactional",
    difficulty: "beginner",
    items: [
      { text: "Confirm whether you need the compressed file's text to stay selectable/searchable — compression re-encodes every page as an image, so if searchable text matters, keep the original alongside the compressed copy." },
      {
        text: "Choose a quality level intentionally: Maximum Compression for the smallest file, High Quality when visual fidelity matters more than size.",
        tool: { type: "tool", id: "tool-compress-pdf" },
      },
      { text: "After compressing, check the page count matches the original — compression changes file size and image quality, never page count or order." },
      { text: "Open the compressed file and spot-check a photo-heavy page at actual size before sending it anywhere — this is the fastest way to catch a quality level that was too aggressive." },
      {
        text: "If the file is still too large after Maximum Compression, the content itself may need splitting rather than further compression.",
        tool: { type: "tool", id: "tool-split-pdf" },
      },
    ],
    related: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "guide", id: "guide-how-pdf-compression-works" },
      { type: "guide", id: "guide-lossy-vs-lossless-pdf-compression" },
    ],
  },
  {
    type: "checklist",
    id: "checklist-heic-photo-conversion",
    slug: "heic-photo-conversion-checklist",
    path: "/checklists/heic-photo-conversion-checklist",
    title: "HEIC Photo Conversion Checklist",
    description:
      "Before converting an iPhone HEIC photo, and before sharing the result, these are the things worth checking — grounded in exactly how PDFPilot's HEIC tools work.",
    searchIntent: "transactional",
    difficulty: "beginner",
    items: [
      { text: "Confirm the file is actually HEIC/HEIF — both tools check this and will tell you clearly if the uploaded file isn't a real HEIC photo, rather than producing a broken result." },
      {
        text: "Choose JPG for sharing, uploading, or emailing — it's smaller and universally accepted.",
        tool: { type: "tool", id: "tool-heic-to-jpg" },
      },
      {
        text: "Choose PNG only if you specifically need lossless quality or transparency — otherwise it's a larger file for no practical benefit, since the source photo has neither transparency nor anything a lossy JPG would visibly lose.",
        tool: { type: "tool", id: "tool-heic-to-png" },
      },
      { text: "Expect the first conversion in a browser session to take a little longer — the HEIC decoder itself has to load once, then stays cached for the rest of the session." },
      { text: "If the resulting image needs to fit a website or CMS's upload limits, resize it after converting rather than before — resizing the original HEIC isn't supported." },
    ],
    related: [
      { type: "tool", id: "tool-heic-to-jpg" },
      { type: "tool", id: "tool-heic-to-png" },
      { type: "guide", id: "guide-how-heic-photo-conversion-works" },
      { type: "learning-resource", id: "learning-resource-what-is-heic" },
    ],
  },
];

export function getChecklist(path: string): ChecklistEntity | undefined {
  return CHECKLISTS.find((checklist) => checklist.path === path);
}
