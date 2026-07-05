import type { BaseContentEntity } from "./types";

export interface HelpEntity extends BaseContentEntity {
  type: "help";
  /** The symptom, framed as the question a user would actually search. */
  question: string;
  /** Cause + fix combined — this is what makes Help reusable as FAQPage schema. */
  answer: string;
}

/**
 * Seed content grounded in real, verifiable product behavior: the Merge PDFs
 * button is disabled via `files.length < 2` in merge-pdf-client.tsx — nothing
 * here is invented.
 */
export const HELP_ENTRIES: readonly HelpEntity[] = [
  {
    type: "help",
    id: "help-why-is-the-merge-button-disabled",
    slug: "why-is-the-merge-button-disabled",
    path: "/help/why-is-the-merge-button-disabled",
    title: "Why Is the Merge PDFs Button Disabled?",
    description:
      "The Merge PDFs button stays disabled until you've added at least two files. Here's why, and what to do about it.",
    question: "Why is the Merge PDFs button disabled?",
    answer:
      "The Merge PDFs button only becomes active once you've added at least two files. Merging a single file wouldn't combine anything, so PDFPilot keeps the button disabled until there's something to merge. Add a second PDF using the upload area, and the button will become clickable.",
    related: [{ type: "tool", id: "tool-merge-pdf" }],
  },
  {
    type: "help",
    id: "help-why-is-my-compressed-pdf-blurry",
    slug: "why-is-my-compressed-pdf-blurry",
    path: "/help/why-is-my-compressed-pdf-blurry",
    title: "Why Is My Compressed PDF Blurry?",
    description:
      "A blurry result after compression usually comes down to the quality setting you chose, not a mistake. Here's why, and how to get a sharper file.",
    question: "Why is my compressed PDF blurry?",
    answer:
      "Compression rebuilds each page as a JPEG image at a resolution and quality tied to the setting you chose. Maximum Compression uses the lowest scale (0.6) and JPEG quality (0.5), which shrinks file size the most but also reduces sharpness — especially on pages with small text or fine detail. If a compressed page looks blurry, that's expected at that setting, not a malfunction. Choosing Medium or High Quality trades some file-size reduction for a sharper result. If you need to preserve both a small size and readable text, try Medium first and only drop to Maximum Compression if the file is still too large afterward.",
    related: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "guide", id: "guide-how-pdf-compression-works" },
    ],
  },
  {
    type: "help",
    id: "help-why-cant-i-select-text-in-compressed-pdf",
    slug: "why-cant-i-select-text-in-compressed-pdf",
    path: "/help/why-cant-i-select-text-in-compressed-pdf",
    title: "Why Can't I Select Text in My Compressed PDF?",
    description:
      "Compressing a PDF turns each page into an image, which is why the text is no longer selectable afterward. Here's what that means for your file.",
    question: "Why can't I select text in my compressed PDF?",
    answer:
      "Compress PDF works by rendering each page onto a canvas and re-encoding it as a JPEG image, then rebuilding the PDF from those images. That's what makes the file smaller — but it also means every page becomes a picture of your original content rather than the original text and fonts. Once a page is compressed this way, its text can no longer be selected, searched, or copied, even though it still looks correct. If you need a version of the file that keeps its text selectable, keep your original PDF alongside the compressed copy — compression isn't reversible, so the source file is the only place the text remains intact.",
    related: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "guide", id: "guide-how-pdf-compression-works" },
    ],
  },
  {
    type: "help",
    id: "help-best-compression-setting-for-email",
    slug: "best-compression-setting-for-email",
    path: "/help/best-compression-setting-for-email",
    title: "What's the Best Compression Setting for Email?",
    description:
      "Most email providers cap attachment size, so picking the right compression setting matters. Here's how to choose.",
    question: "What's the best compression setting for sending a PDF by email?",
    answer:
      "Most email providers cap attachments somewhere between 10MB and 25MB, so the right setting depends on how large your original file is and how much you need to shrink it. Medium is a reasonable starting point — it reduces file size while keeping pages sharp enough to read comfortably. If the compressed file is still too large for your email provider's limit, switch to Maximum Compression for the smallest possible result. If your PDF has more pages than you actually need to send, extracting just the relevant pages first — before compressing — can reduce the size further than compression alone.",
    related: [
      { type: "tool", id: "tool-compress-pdf" },
      { type: "use-case", id: "use-case-extract-and-shrink-pages-from-a-large-pdf" },
    ],
  },
];

export function getHelp(path: string): HelpEntity | undefined {
  return HELP_ENTRIES.find((entry) => entry.path === path);
}
