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
    slug: "why-is-the-merge-button-disabled",
    path: "/help/why-is-the-merge-button-disabled",
    title: "Why Is the Merge PDFs Button Disabled?",
    description:
      "The Merge PDFs button stays disabled until you've added at least two files. Here's why, and what to do about it.",
    question: "Why is the Merge PDFs button disabled?",
    answer:
      "The Merge PDFs button only becomes active once you've added at least two files. Merging a single file wouldn't combine anything, so PDFPilot keeps the button disabled until there's something to merge. Add a second PDF using the upload area, and the button will become clickable.",
    related: [{ type: "tool", path: "/merge-pdf" }],
  },
];

export function getHelp(path: string): HelpEntity | undefined {
  return HELP_ENTRIES.find((entry) => entry.path === path);
}
