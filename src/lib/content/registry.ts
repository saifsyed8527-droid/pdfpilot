import { TOOLS } from "@/lib/tools";
import { GUIDES } from "./guides";
import { HELP_ENTRIES } from "./help";
import { COMPARISONS } from "./comparisons";
import { USE_CASES } from "./use-cases";
import { CATEGORIES } from "./categories";
import type { ContentType, EntityRef } from "./types";

export interface ResolvedEntity {
  type: ContentType;
  id: string;
  title: string;
  path: string;
}

const KNOWN_CONTENT_TYPES: ReadonlySet<ContentType> = new Set([
  "tool",
  "category",
  "guide",
  "comparison",
  "use-case",
  "help",
  "faq",
  "learning-resource",
]);

export class ContentGraphError extends Error {
  constructor(message: string) {
    super(`[content graph] ${message}`);
    this.name = "ContentGraphError";
  }
}

/**
 * A single, flat, id-indexed lookup across every content type — O(1)
 * resolution instead of a per-type linear scan, and the natural place to
 * catch duplicate ids as they're registered (Sprint 6.1, Task 3 + Task 4).
 */
const ENTITY_INDEX = new Map<string, ResolvedEntity>();

function register(
  type: ContentType,
  entities: readonly { id: string; title: string; path: string }[]
) {
  for (const entity of entities) {
    if (!entity.id) {
      throw new ContentGraphError(
        `A "${type}" entity at path "${entity.path}" is missing an id.`
      );
    }
    if (ENTITY_INDEX.has(entity.id)) {
      throw new ContentGraphError(`Duplicate entity id "${entity.id}".`);
    }
    ENTITY_INDEX.set(entity.id, { type, id: entity.id, title: entity.title, path: entity.path });
  }
}

// Tool has both a short `name` ("Compress PDF") and a long SEO `title`
// ("Compress PDF Online Free | PDFPilot") — the resolver must use `name`,
// exactly as it did before this migration, or every rendered link and
// schema `name` for a Tool reference would silently switch to the long
// title. Every other content type only has `title`, so it's used directly.
register(
  "tool",
  TOOLS.map((tool) => ({ id: tool.id, title: tool.name, path: tool.path }))
);
register("guide", GUIDES);
register("help", HELP_ENTRIES);
register("comparison", COMPARISONS);
register("use-case", USE_CASES);
register("category", CATEGORIES);

/**
 * Validates the whole content graph once, at module load — which Next.js
 * evaluates during `next build` (and `next dev`) before any page using it
 * can render. A broken reference anywhere fails the build with a
 * descriptive error instead of silently dropping a link at runtime.
 */
function validateContentGraph(): void {
  // Every path must be unique across the whole graph, not just per type —
  // two entities can't legitimately share a URL regardless of their type.
  const pathOwners = new Map<string, string>();
  for (const [id, entity] of ENTITY_INDEX) {
    const owner = pathOwners.get(entity.path);
    if (owner) {
      throw new ContentGraphError(
        `Duplicate path "${entity.path}" used by both "${owner}" and "${id}".`
      );
    }
    pathOwners.set(entity.path, id);
  }

  // Collect every EntityRef in the graph, tagged with the entity that owns
  // it, so a broken reference produces a useful error message.
  const allRefs: { source: string; ref: EntityRef }[] = [];
  const collect = (source: string, refs: EntityRef[] | undefined) => {
    for (const ref of refs ?? []) allRefs.push({ source, ref });
  };

  for (const guide of GUIDES) collect(guide.id, guide.related);
  for (const entry of HELP_ENTRIES) collect(entry.id, entry.related);
  for (const comparison of COMPARISONS) {
    collect(comparison.id, comparison.related);
    collect(comparison.id, comparison.items);
  }
  for (const useCase of USE_CASES) {
    collect(useCase.id, useCase.related);
    collect(
      useCase.id,
      useCase.steps.map((step) => step.tool)
    );
  }
  for (const category of CATEGORIES) {
    collect(category.id, category.related);
    collect(category.id, category.contains);
  }

  for (const { source, ref } of allRefs) {
    if (!KNOWN_CONTENT_TYPES.has(ref.type)) {
      throw new ContentGraphError(`"${source}" references unknown entity type "${ref.type}".`);
    }
    if (!ENTITY_INDEX.has(ref.id)) {
      throw new ContentGraphError(
        `"${source}" references missing entity id "${ref.id}" (type "${ref.type}").`
      );
    }
  }

  // Orphans (entities with zero incoming references) are informational,
  // not fatal — Tool -> content back-linking is intentionally not
  // implemented yet, so every content entity is expected to be an orphan
  // today. This is a visibility aid for future sprints, not a build gate.
  const referenced = new Set(allRefs.map((r) => r.ref.id));
  const orphans = [...ENTITY_INDEX.keys()].filter((id) => !referenced.has(id));
  if (orphans.length > 0) {
    console.warn(
      `[content graph] ${orphans.length} entities have no incoming references yet: ${orphans.join(", ")}`
    );
  }
}

validateContentGraph();

/**
 * The single place that knows how to turn an EntityRef into a real,
 * renderable entity. Adding a new content type later means adding one
 * `register(...)` call above — no page that renders related content, and
 * no switch statement here, needs to change.
 */
export function resolveEntity(ref: EntityRef): ResolvedEntity | undefined {
  return ENTITY_INDEX.get(ref.id);
}

export function resolveEntities(refs: EntityRef[] = []): ResolvedEntity[] {
  return refs
    .map(resolveEntity)
    .filter((entity): entity is ResolvedEntity => entity !== undefined);
}
