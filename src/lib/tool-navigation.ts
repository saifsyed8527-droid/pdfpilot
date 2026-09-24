import { TOOLS, type Tool } from "./tools";

export interface ToolNavGroup {
  group: string;
  tools: Tool[];
}

export interface ToolNavCategory {
  navCategory: string;
  groups: ToolNavGroup[];
}

/**
 * The launch uses the owner's exact sequence, not the old category ordering.
 * New registry entries stay hidden until explicitly added to launch-catalog.
 */
export function getToolNavigation(): ToolNavCategory[] {
  return [{ navCategory: "All Tools", groups: [{ group: "Tools", tools: [...TOOLS] }] }];
}
