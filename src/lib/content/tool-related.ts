import { GUIDES } from "./guides";
import { HELP_ENTRIES } from "./help";
import { COMPARISONS } from "./comparisons";
import { USE_CASES } from "./use-cases";
import { CATEGORIES } from "./categories";
import { resolveEntity, type ResolvedEntity } from "./registry";
import type { EntityRef } from "./types";

function refsIncludeTool(refs: EntityRef[] | undefined, toolId: string): boolean {
  return (refs ?? []).some((ref) => ref.type === "tool" && ref.id === toolId);
}

/**
 * The forward direction (an entity's own `related: EntityRef[]`) is resolved
 * by registry.ts. Tool pages need the opposite direction — "what content
 * points at me" — which no entity stores directly, so it's computed here by
 * scanning the same content arrays the registry already indexes, rather than
 * maintaining a second hardcoded relationship list per tool.
 */
export function getContentReferencingTool(toolId: string): ResolvedEntity[] {
  const sources: { id: string; type: "guide" | "help" | "comparison" | "use-case" | "category" }[] = [];

  for (const guide of GUIDES) {
    if (refsIncludeTool(guide.related, toolId)) sources.push({ id: guide.id, type: "guide" });
  }
  for (const entry of HELP_ENTRIES) {
    if (refsIncludeTool(entry.related, toolId)) sources.push({ id: entry.id, type: "help" });
  }
  for (const comparison of COMPARISONS) {
    if (refsIncludeTool(comparison.related, toolId) || refsIncludeTool(comparison.items, toolId)) {
      sources.push({ id: comparison.id, type: "comparison" });
    }
  }
  for (const useCase of USE_CASES) {
    const inSteps = useCase.steps.some((step) => step.tool.type === "tool" && step.tool.id === toolId);
    if (refsIncludeTool(useCase.related, toolId) || inSteps) {
      sources.push({ id: useCase.id, type: "use-case" });
    }
  }
  for (const category of CATEGORIES) {
    if (refsIncludeTool(category.related, toolId) || refsIncludeTool(category.contains, toolId)) {
      sources.push({ id: category.id, type: "category" });
    }
  }

  return sources
    .map(({ type, id }) => resolveEntity({ type, id }))
    .filter((entity): entity is ResolvedEntity => entity !== undefined);
}
