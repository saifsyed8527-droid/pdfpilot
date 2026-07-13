import {
  CodeXml,
  Copy,
  Crop,
  FileCode,
  FileDiff,
  FileImage,
  FileOutput,
  FilePlus2,
  FileSearch,
  FileSpreadsheet,
  FileStack,
  FileText,
  FileType,
  FileX,
  FormInput,
  Hash,
  ImageIcon,
  Images,
  Layers,
  Maximize2,
  Merge,
  Minimize2,
  NotebookText,
  PenTool,
  Presentation,
  RotateCw,
  Scan,
  ScanText,
  Scissors,
  Shuffle,
  Stamp,
  Table,
  Zap,
  type LucideIcon,
} from "lucide-react";
import toolsData from "./tools-data.json";

/**
 * The canonical Tool model. Every consumer that needs "what tools exist"
 * (navbar, footer, homepage grid, sitemap, JSON-LD/schema generation, OG
 * asset generation) derives from the single TOOLS array below instead of
 * maintaining its own list.
 */
export interface Tool {
  /** Stable, immutable internal identifier for cross-type relationships
   *  (Sprint 6.1) — "tool-{slug}". Never used for routing; `path` still
   *  governs the real URL. */
  id: string;
  /** Bare identifier, no leading slash, e.g. "merge-pdf". Matches OG filenames. */
  slug: string;
  /** Public route — unchanged, must never drift from production URLs. */
  path: string;
  /** Document-type family this tool belongs to. Single value ("pdf") today;
   *  present now so a future second domain (e.g. "image") needs no migration. */
  domain: string;
  /** Functional grouping, for category hub pages. Not the same as `group`. */
  category: string;
  /** Homepage display grouping (e.g. "Core PDF", "Page Management") — distinct
   *  from `category`, which drives category hub URLs, not homepage layout. */
  group: string;
  /** Top-level navigation grouping (e.g. "PDF Tools", "Image Tools") — the
   *  first level of the mega menu. Distinct from `group`, which is the mega
   *  menu's second level (and the homepage's section headers). */
  navCategory: string;
  /** Explicit display order across nav/footer/home, independent of array position. */
  order: number;
  /** Short display name — nav, footer, schema `name`, OG image title, home card title. */
  name: string;
  /** Full <title> tag / SEO title. */
  title: string;
  /** Long-form SEO meta description, also used for schema description and OG alt text. */
  description: string;
  /** Short homepage-card blurb — distinct from the SEO description by design. */
  tagline: string;
  /** OG image subtitle line — distinct from both description and tagline by design. */
  ogSubtitle: string;
  /** Homepage grid icon. Not plain data, so it's attached here rather than in JSON. */
  icon: LucideIcon;
  /** Stable Tool ids (e.g. "tool-rotate-pdf") this tool should recommend,
   *  resolved via the content registry exactly like any other EntityRef. */
  relatedTools: string[];
}

type ToolData = Omit<Tool, "icon">;

const ICONS: Record<string, LucideIcon> = {
  "merge-pdf": Merge,
  "split-pdf": Scissors,
  "compress-pdf": Zap,
  "pdf-to-jpg": ImageIcon,
  "jpg-to-pdf": FileText,
  "rotate-pdf": RotateCw,
  "add-page-numbers": Hash,
  "delete-pages": FileX,
  "extract-pages": FileOutput,
  "rearrange-pages": Shuffle,
  "watermark-pdf": Stamp,
  "crop-pdf": Crop,
  "fill-pdf": FormInput,
  "word-to-pdf": FileType,
  "pdf-to-word": NotebookText,
  "pdf-to-powerpoint": Presentation,
  "pdf-metadata-editor": FileSearch,
  "duplicate-pages": Copy,
  "convert-image": Images,
  "resize-image": Maximize2,
  "ocr-pdf": ScanText,
  "flatten-pdf": Layers,
  "insert-pages": FilePlus2,
  "compare-pdf": FileDiff,
  "crop-image": Crop,
  "rotate-image": RotateCw,
  "compress-image": Minimize2,
  "image-metadata": FileImage,
  "ocr-image": Scan,
  "docx-merge": FileStack,
  "txt-to-pdf": FileText,
  "markdown-to-pdf": FileCode,
  "csv-to-pdf": Table,
  "excel-to-pdf": FileSpreadsheet,
  "powerpoint-to-pdf": Presentation,
  "csv-to-xml": CodeXml,
  "xml-to-csv": Table,
  "excel-to-xml": CodeXml,
  "xml-to-excel": FileSpreadsheet,
  "heic-to-jpg": ImageIcon,
  "heic-to-png": FileImage,
  "svg-to-pdf": PenTool,
  "image-watermark": Stamp,
};

export const TOOLS: readonly Tool[] = (toolsData as ToolData[]).map((tool) => ({
  ...tool,
  icon: ICONS[tool.slug],
}));

export function getTool(path: string): Tool | undefined {
  return TOOLS.find((tool) => tool.path === path);
}
