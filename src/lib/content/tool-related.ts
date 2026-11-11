import { getBacklinks, type ResolvedEntity } from "./registry";

/**
 * The forward direction (an entity's own `related: EntityRef[]`) is
 * resolved by registry.ts's `resolveEntities`. Tool pages need the
 * opposite direction — "what content points at me" — which is exactly
 * what registry.ts's generic, graph-wide `getBacklinks` computes.
 *
 * This function used to hand-scan Guides/Help/Comparisons/Use
 * Cases/Categories itself (five separate loops, one per content type,
 * duplicating logic `getBacklinks` now does once for every content type
 * including ones added after this file was written — Industries and
 * Glossary entries flow into every tool's "Related Content" automatically,
 * with no fifth or sixth loop needed here). Kept as a thin, tool-specific
 * name rather than inlining `getBacklinks` at all 35 call sites, since
 * "backlinks for a tool" is a meaningful, stable concept worth naming even
 * though it's no longer implemented separately.
 */
export function getContentReferencingTool(toolId: string): ResolvedEntity[] {
  return getBacklinks(toolId);
}

/** A short, varied reading list. The full topic remains available through its hub. */
export function getToolLearningLinks(toolId: string) {
  const content = getContentReferencingTool(toolId);
  const categories = content.filter(item => item.type === "category");
  const candidates = content.filter(item => ["guide", "help", "use-case", "checklist", "comparison"].includes(item.type));
  const selected: ResolvedEntity[] = [];
  for (const type of ["guide", "help", "use-case", "checklist", "comparison"]) {
    const item = candidates.find(item => item.type === type);
    if (item) selected.push(item);
  }
  for (const item of candidates) {
    if (selected.length >= 6) break;
    if (!selected.some(selected => selected.id === item.id)) selected.push(item);
  }
  return { categories, items: selected };
}
