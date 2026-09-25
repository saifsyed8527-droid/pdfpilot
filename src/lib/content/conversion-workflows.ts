import rows from "./conversion-workflows.json";
import { isConversionTool, type ConversionToolSlug } from "../i18n/conversion-copy";

export const CONVERSION_WORKFLOWS = rows.map((row) => {
  if (!isConversionTool(row.tool) || row.status !== "reviewed") throw new Error(`Unreviewed conversion workflow: ${row.slug}`);
  return { ...row, tool: row.tool as ConversionToolSlug, path: `/workflows/${row.slug}` };
});
export const getConversionWorkflows = (tool: string) => CONVERSION_WORKFLOWS.filter((page) => page.tool === tool);
export const getConversionWorkflow = (slug: string) => CONVERSION_WORKFLOWS.find((page) => page.slug === slug);
