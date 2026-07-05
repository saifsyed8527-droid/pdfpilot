import type { BaseContentEntity, EntityRef } from "./types";

export interface UseCaseEntity extends BaseContentEntity {
  type: "use-case";
  steps: { tool: EntityRef; instruction: string }[];
}

export const USE_CASES: readonly UseCaseEntity[] = [
  {
    type: "use-case",
    slug: "extract-and-shrink-pages-from-a-large-pdf",
    path: "/use-cases/extract-and-shrink-pages-from-a-large-pdf",
    title: "Extract and Shrink Pages From a Large PDF",
    description:
      "Only need a few pages from a large PDF, and need to keep the result small enough to email? Here's the two-step way to do it.",
    steps: [
      {
        tool: { type: "tool", path: "/split-pdf" },
        instruction: "Use Split PDF to pull out just the page range you need from the original document.",
      },
      {
        tool: { type: "tool", path: "/compress-pdf" },
        instruction: "If the extracted pages are still too large to send, run the result through Compress PDF to shrink the file size further.",
      },
    ],
    related: [
      { type: "tool", path: "/split-pdf" },
      { type: "tool", path: "/compress-pdf" },
    ],
  },
];

export function getUseCase(path: string): UseCaseEntity | undefined {
  return USE_CASES.find((useCase) => useCase.path === path);
}
