import { z } from "zod";
import rows from "./conversion-templates.json";
import type { ImagePdfOptions } from "../engines/jpg-to-pdf-engine";

export const TEMPLATE_ROOT = "/templates/conversions";
export const TEMPLATE_TOOLS = ["jpg-to-pdf", "word-to-pdf", "powerpoint-to-pdf"] as const;
export const TEMPLATE_TOOL_NAMES = { "jpg-to-pdf": "JPG to PDF", "word-to-pdf": "Word to PDF", "powerpoint-to-pdf": "PowerPoint to PDF" };
const rowSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/), tool: z.enum(TEMPLATE_TOOLS),
  title: z.string().min(12), description: z.string().min(60), input: z.string(), output: z.string(),
  preset: z.object({ pageSize: z.enum(["a4", "letter", "fit"]), orientation: z.enum(["portrait", "landscape", "auto"]), margin: z.enum(["none", "small", "big"]), merge: z.boolean() }).strict().optional(),
  samples: z.array(z.string().regex(/^[a-z0-9-]+\.(jpg|png|docx|pptx)$/)).min(1),
  facts: z.array(z.tuple([z.string().min(1), z.string().min(1)])).min(4),
  checks: z.array(z.string().min(20)).min(2), question: z.string().min(20), answer: z.string().min(60),
  tags: z.array(z.string()).min(3), legacy: z.string().optional(),
}).strict();

export const CONVERSION_TEMPLATES = z.array(rowSchema).parse(rows).map(row => {
  if ((row.tool === "jpg-to-pdf") !== Boolean(row.preset)) throw new Error(`Invalid executable preset: ${row.slug}`);
  const extensions = row.tool === "jpg-to-pdf" ? ["jpg", "png"] : row.tool === "word-to-pdf" ? ["docx"] : ["pptx"];
  if (row.samples.some(file => !extensions.includes(file.split(".").at(-1)!))) throw new Error(`Wrong sample format: ${row.slug}`);
  return { ...row, path: `${TEMPLATE_ROOT}/${row.tool}/${row.slug}`, preview: `/template-samples/previews/${row.tool}-${row.slug}.png` };
});
if (new Set(CONVERSION_TEMPLATES.map(row => row.path)).size !== CONVERSION_TEMPLATES.length) throw new Error("Duplicate template URL");
export type ConversionTemplate = (typeof CONVERSION_TEMPLATES)[number];
export type TemplateSession = { samples: string[]; preset?: ImagePdfOptions };
export const templatesForTool = (tool: string) => CONVERSION_TEMPLATES.filter(row => row.tool === tool);
export const getConversionTemplate = (tool: string, slug: string) => CONVERSION_TEMPLATES.find(row => row.tool === tool && row.slug === slug);
