import { TOOLS } from "@/lib/tools";

/**
 * Derived from the canonical Tool model (src/lib/tools.ts) — this is a
 * thin, SEO-scoped projection, not a second source of data. Adding a
 * `title` field (needed for page metadata) here rather than importing
 * `Tool` directly keeps this module's public shape unchanged for its
 * existing consumers (the 5 tool page.tsx files).
 */
export interface ToolSeoEntry {
  /** Human-readable tool name, e.g. "Merge PDF" */
  name: string;
  /** Route path starting with "/", e.g. "/merge-pdf" */
  path: string;
  description: string;
  /** Full <title> tag text, e.g. "Merge PDF Files Online Free | PDFPilot" */
  title: string;
}

export const TOOL_SEO_REGISTRY: readonly ToolSeoEntry[] = TOOLS.map(
  ({ name, path, description, title }) => ({ name, path, description, title })
);

export function getToolSeo(path: string): ToolSeoEntry | undefined {
  return TOOL_SEO_REGISTRY.find((tool) => tool.path === path);
}
