import type { BaseContentEntity } from "./types";
import type { TemplateGeneratorId } from "@/lib/engines/template-engine";

export interface TemplateEntity extends BaseContentEntity {
  type: "template";
  /** Which real function in template-engine.ts builds this file — content
   *  data (title, description, SEO) stays separate from generation logic,
   *  the same Engine Layer separation every tool already follows. */
  generatorId: TemplateGeneratorId;
  downloadFileName: string;
}

/**
 * Programmatic Content Engine — Template generator. One real template
 * this sprint (Invoice), proving the content type end-to-end: a genuinely
 * fillable PDF built with pdf-lib's real form-field API, generated
 * client-side on download, not a static file pretending to be dynamic.
 */
export const TEMPLATES: readonly TemplateEntity[] = [
  {
    type: "template",
    id: "template-invoice",
    slug: "invoice-template",
    path: "/templates/invoice-template",
    title: "Free Fillable Invoice Template (PDF)",
    description:
      "A real, fillable PDF invoice template — type directly into it in any PDF reader. Generated on demand in your browser, not a static download.",
    searchIntent: "transactional",
    difficulty: "beginner",
    generatorId: "invoice",
    downloadFileName: "invoice-template.pdf",
    related: [
      { type: "industry", id: "industry-accounting-finance" },
      { type: "tool", id: "tool-fill-pdf" },
      { type: "tool", id: "tool-flatten-pdf" },
    ],
  },
];

export function getTemplate(path: string): TemplateEntity | undefined {
  return TEMPLATES.find((template) => template.path === path);
}
