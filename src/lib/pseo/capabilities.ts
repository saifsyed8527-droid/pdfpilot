import rows from "./capabilities.json";
import { capabilitySchema } from "./schema";
import { LAUNCH_TOOL_SLUGS, LOCALIZED_LAUNCH_TOOL_SLUGS } from "../launch-catalog";
/** Product capabilities include launches; the existing pSEO scope stays unchanged. */
export const LAUNCH_CAPABILITIES = rows.map(row => capabilitySchema.parse(row));
const launchCapabilityIds = new Set(LAUNCH_CAPABILITIES.map(row => row.toolId));
if (LAUNCH_CAPABILITIES.length !== LAUNCH_TOOL_SLUGS.length || launchCapabilityIds.size !== LAUNCH_TOOL_SLUGS.length || LAUNCH_TOOL_SLUGS.some(id => !launchCapabilityIds.has(id))) {
  throw new Error("Every public tool must have exactly one launch capability declaration");
}
export const CAPABILITIES = LAUNCH_CAPABILITIES.filter(row => LOCALIZED_LAUNCH_TOOL_SLUGS.includes(row.toolId));
export const CAPABILITY_BY_ID = new Map(CAPABILITIES.map(row => [row.toolId, row]));
if (CAPABILITIES.length !== 26 || CAPABILITY_BY_ID.size !== 26 || LOCALIZED_LAUNCH_TOOL_SLUGS.some(id => !CAPABILITY_BY_ID.has(id))) {
  throw new Error("pSEO scope must match exactly the 26 approved public tools");
}
export function privacyCopy(toolId: string): string {
  const tool = CAPABILITY_BY_ID.get(toolId);
  if (!tool || tool.processingMode === "unknown") return "Processing details have not been verified for this tool.";
  return tool.privacyFacts.join(" ");
}
