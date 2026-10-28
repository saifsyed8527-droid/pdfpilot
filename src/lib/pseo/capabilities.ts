import rows from "./capabilities.json";
import { capabilitySchema } from "./schema";
import { LAUNCH_TOOL_SLUGS, LOCALIZED_LAUNCH_TOOL_SLUGS } from "../launch-catalog";
/** Reviewed processing evidence is independent of public catalog visibility. */
export const LAUNCH_CAPABILITIES = rows.map(row => capabilitySchema.parse(row));
const launchCapabilityIds = new Set(LAUNCH_CAPABILITIES.map(row => row.toolId));
if (launchCapabilityIds.size !== LAUNCH_CAPABILITIES.length || [...launchCapabilityIds].some(id => !LAUNCH_TOOL_SLUGS.includes(id))) {
  throw new Error("Reviewed capability declarations must be unique and reference public tools");
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
