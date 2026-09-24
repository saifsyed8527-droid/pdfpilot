import { TOOLS, type Tool } from "./tools";

export interface ToolNavGroup {
  group: string;
  tools: Tool[];
}

export interface ToolNavCategory {
  navCategory: string;
  groups: ToolNavGroup[];
}

/** Functional groups shared by desktop and mobile. Homepage order is separate. */
export const TOOL_NAV_GROUPS = [
  { name: "Convert to PDF", slugs: ["jpg-to-pdf", "word-to-pdf", "powerpoint-to-pdf", "excel-to-pdf", "html-to-pdf"] },
  { name: "Convert from PDF", slugs: ["pdf-to-jpg", "pdf-to-word", "pdf-to-powerpoint", "pdf-to-excel", "pdf-to-pdfa"] },
  { name: "Organize PDF", slugs: ["merge-pdf", "split-pdf", "delete-pages", "extract-pages", "organize-pdf", "rotate-pdf"] },
  { name: "Optimize & scan", slugs: ["compress-pdf", "repair-pdf", "ocr-pdf", "scan-pdf"] },
  { name: "Edit PDF", slugs: ["add-page-numbers", "watermark-pdf", "crop-pdf", "edit-pdf", "fill-pdf"] },
  { name: "Spreadsheet tools", slugs: ["excel-to-xml"] },
] as const;

export function getToolNavigation(): ToolNavCategory[] {
  return TOOL_NAV_GROUPS.map(({ name, slugs }) => ({
    navCategory: name,
    groups: [{ group: name, tools: slugs.flatMap((slug) => TOOLS.filter((tool) => tool.slug === slug)) }],
  }));
}
