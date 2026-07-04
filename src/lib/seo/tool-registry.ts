export interface ToolSeoEntry {
  /** Human-readable tool name, e.g. "Merge PDF" */
  name: string;
  /** Route path starting with "/", e.g. "/merge-pdf" */
  path: string;
  description: string;
}

export const TOOL_SEO_REGISTRY: readonly ToolSeoEntry[] = [
  {
    name: "Merge PDF",
    path: "/merge-pdf",
    description:
      "Combine multiple PDF files into one document in seconds. Free, secure, and fast — no upload required, all processing happens in your browser.",
  },
  {
    name: "Split PDF",
    path: "/split-pdf",
    description:
      "Extract or split pages from any PDF file instantly. Free and secure PDF splitting tool that works entirely in your browser.",
  },
  {
    name: "Compress PDF",
    path: "/compress-pdf",
    description:
      "Reduce PDF file size without losing quality. Free online PDF compression tool with adjustable quality settings, all processed in your browser.",
  },
  {
    name: "PDF to JPG",
    path: "/pdf-to-jpg",
    description:
      "Convert PDF pages into high-quality JPG images instantly. Free, fast, and secure — no software installation needed.",
  },
  {
    name: "JPG to PDF",
    path: "/jpg-to-pdf",
    description:
      "Turn your JPG and PNG images into a single PDF document in seconds. Free online image-to-PDF converter that works in your browser.",
  },
] as const;

export function getToolSeo(path: string): ToolSeoEntry | undefined {
  return TOOL_SEO_REGISTRY.find((tool) => tool.path === path);
}
