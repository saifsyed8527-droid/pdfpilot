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
 * The single derivation of "how tools are organized for navigation"
 * (navCategory -> group -> tools), computed once from TOOLS. Both the
 * desktop mega menu and the mobile accordion render from this — neither
 * hardcodes a tool list or re-derives the grouping independently. Adding a
 * tool to tools-data.json is the only step required for it to appear in
 * both automatically; a navCategory with zero tools is simply absent from
 * the result rather than rendered empty.
 */
export function getToolNavigation(): ToolNavCategory[] {
  const categories = new Map<string, Map<string, Tool[]>>();

  for (const tool of TOOLS) {
    if (!categories.has(tool.navCategory)) {
      categories.set(tool.navCategory, new Map());
    }
    const groups = categories.get(tool.navCategory)!;
    if (!groups.has(tool.group)) {
      groups.set(tool.group, []);
    }
    groups.get(tool.group)!.push(tool);
  }

  return [...categories.entries()].map(([navCategory, groups]) => ({
    navCategory,
    groups: [...groups.entries()].map(([group, tools]) => ({
      group,
      tools: [...tools].sort((a, b) => a.order - b.order),
    })),
  }));
}
