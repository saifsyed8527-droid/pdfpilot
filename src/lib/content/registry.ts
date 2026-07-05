import { getTool } from "@/lib/tools";
import { getGuide } from "./guides";
import { getHelp } from "./help";
import { getComparison } from "./comparisons";
import { getUseCase } from "./use-cases";
import { getCategory } from "./categories";
import type { ContentType, EntityRef } from "./types";

export interface ResolvedEntity {
  type: ContentType;
  title: string;
  path: string;
}

/**
 * The single place that knows how to turn an EntityRef into a real,
 * renderable entity. Adding a new content type later means adding one
 * case here — no page that renders related content needs to change.
 */
export function resolveEntity(ref: EntityRef): ResolvedEntity | undefined {
  switch (ref.type) {
    case "tool": {
      const tool = getTool(ref.path);
      return tool ? { type: "tool", title: tool.name, path: tool.path } : undefined;
    }
    case "guide": {
      const guide = getGuide(ref.path);
      return guide ? { type: "guide", title: guide.title, path: guide.path } : undefined;
    }
    case "help": {
      const help = getHelp(ref.path);
      return help ? { type: "help", title: help.title, path: help.path } : undefined;
    }
    case "comparison": {
      const comparison = getComparison(ref.path);
      return comparison
        ? { type: "comparison", title: comparison.title, path: comparison.path }
        : undefined;
    }
    case "use-case": {
      const useCase = getUseCase(ref.path);
      return useCase ? { type: "use-case", title: useCase.title, path: useCase.path } : undefined;
    }
    case "category": {
      const category = getCategory(ref.path);
      return category
        ? { type: "category", title: category.title, path: category.path }
        : undefined;
    }
    // "faq" | "learning-resource" are reserved for future sprints — no
    // registry backing them yet (see Sprint 5.1 design notes on why FAQ
    // is a composition of its parent, not an independent resolvable page).
    default:
      return undefined;
  }
}

export function resolveEntities(refs: EntityRef[] = []): ResolvedEntity[] {
  return refs
    .map(resolveEntity)
    .filter((entity): entity is ResolvedEntity => entity !== undefined);
}
