import { FileText, ImageIcon, Merge, Scissors, Zap, type LucideIcon } from "lucide-react";
import toolsData from "./tools-data.json";

/**
 * The canonical Tool model. Every consumer that needs "what tools exist"
 * (navbar, footer, homepage grid, sitemap, JSON-LD/schema generation, OG
 * asset generation) derives from the single TOOLS array below instead of
 * maintaining its own list.
 */
export interface Tool {
  /** Bare identifier, no leading slash, e.g. "merge-pdf". Matches OG filenames. */
  slug: string;
  /** Public route — unchanged, must never drift from production URLs. */
  path: string;
  /** Document-type family this tool belongs to. Single value ("pdf") today;
   *  present now so a future second domain (e.g. "image") needs no migration. */
  domain: string;
  /** Functional grouping, for future category hub pages. Not rendered today. */
  category: string;
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
  /** Future internal-linking field. Unpopulated today — no relationships assigned yet. */
  relatedTools: string[];
}

type ToolData = Omit<Tool, "icon">;

const ICONS: Record<string, LucideIcon> = {
  "merge-pdf": Merge,
  "split-pdf": Scissors,
  "compress-pdf": Zap,
  "pdf-to-jpg": ImageIcon,
  "jpg-to-pdf": FileText,
};

export const TOOLS: readonly Tool[] = (toolsData as ToolData[]).map((tool) => ({
  ...tool,
  icon: ICONS[tool.slug],
}));

export function getTool(path: string): Tool | undefined {
  return TOOLS.find((tool) => tool.path === path);
}
