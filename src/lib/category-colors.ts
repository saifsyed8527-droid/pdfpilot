import type { Tool } from "./tools";

export type ToolCategory =
  | "organize"
  | "optimize"
  | "convert"
  | "convert-alt"
  | "edit"
  | "security"
  | "ai";

export interface CategoryStyle {
  label: ToolCategory;
  iconClass: string;
  bgClass: string;
  ringClass?: string;
}

const STYLES: Record<ToolCategory, CategoryStyle> = {
  organize: {
    label: "organize",
    iconClass: "icon-organize",
    bgClass: "icon-organize-bg",
  },
  optimize: {
    label: "optimize",
    iconClass: "icon-optimize",
    bgClass: "icon-optimize-bg",
  },
  convert: {
    label: "convert",
    iconClass: "icon-convert",
    bgClass: "icon-convert-bg",
  },
  "convert-alt": {
    label: "convert-alt",
    iconClass: "icon-convert-alt",
    bgClass: "icon-convert-alt-bg",
  },
  edit: {
    label: "edit",
    iconClass: "icon-edit",
    bgClass: "icon-edit-bg",
  },
  security: {
    label: "security",
    iconClass: "icon-security",
    bgClass: "icon-security-bg",
  },
  ai: {
    label: "ai",
    iconClass: "icon-ai",
    bgClass: "icon-ai-bg",
  },
};

const TOOL_CATEGORY_OVERRIDE: Record<string, ToolCategory> = {
  "pdf-to-jpg": "convert",
  "jpg-to-pdf": "convert",
  "word-to-pdf": "convert",
  "pdf-to-word": "convert",
  "powerpoint-to-pdf": "convert",
  "pdf-to-powerpoint": "convert",
  "excel-to-pdf": "convert",
  "pdf-to-excel": "convert-alt",
  "html-to-text": "convert",
  "html-to-markdown": "convert",
  "markdown-to-html": "convert",
  "txt-to-pdf": "convert",
  "markdown-to-pdf": "convert",
  "csv-to-pdf": "convert",
  "svg-to-pdf": "convert",
  "heic-to-jpg": "convert",
  "heic-to-png": "convert",
  "convert-image": "convert",
  "ocr-pdf": "convert",
  "ocr-image": "convert",
  "summary-generator": "ai",
  "base64-encode": "security",
  "base64-decode": "security",
  "url-encode": "security",
  "url-decode": "security",
  "lock-pdf": "security",
  "unlock-pdf": "security",
  "json-formatter": "convert",
  "json-minifier": "convert",
  "json-validator": "convert",
  "xml-formatter": "convert",
  "xml-minifier": "convert",
  "xml-validator": "convert",
  "csv-formatter": "convert",
};

export function getCategoryStyle(tool: Tool | { slug: string; category: string }): CategoryStyle {
  const override = TOOL_CATEGORY_OVERRIDE[tool.slug];
  if (override && override in STYLES) return STYLES[override];

  switch (tool.category) {
    case "organize":
      return STYLES.organize;
    case "optimize":
      return STYLES.optimize;
    case "convert":
      return STYLES.convert;
    case "edit":
    case "format":
    case "clean":
      return STYLES.edit;
    default:
      return STYLES.convert;
  }
}

export { STYLES as CATEGORY_STYLES };
