import rows from "./capabilities.json";
import { capabilitySchema } from "./schema";
import { LAUNCH_TOOL_SLUGS } from "../launch-catalog";
export const CAPABILITIES = rows.map(row => capabilitySchema.parse(row));
export const CAPABILITY_BY_ID = new Map(CAPABILITIES.map(row => [row.toolId, row]));
if (CAPABILITIES.length !== 26 || CAPABILITY_BY_ID.size !== 26 || LAUNCH_TOOL_SLUGS.some(id => !CAPABILITY_BY_ID.has(id))) {
  throw new Error("pSEO scope must match exactly the 26 approved public tools");
}
export function privacyCopy(toolId: string): string {
  const tool = CAPABILITY_BY_ID.get(toolId);
  if (!tool || tool.processingMode === "unknown") return "Processing details have not been verified for this tool.";
  return tool.privacyFacts.join(" ");
}
