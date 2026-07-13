import { TOOLS } from "@/lib/tools";
import { GUIDES } from "./guides";
import { HELP_ENTRIES } from "./help";
import { COMPARISONS } from "./comparisons";
import { USE_CASES } from "./use-cases";
import { CATEGORIES } from "./categories";
import { INDUSTRIES } from "./industries";
import { GLOSSARY } from "./glossary";
import { CHECKLISTS } from "./checklists";
import { TEMPLATES } from "./templates";
import type { ContentType, EntityRef } from "./types";

export interface ResolvedEntity {
  type: ContentType;
  id: string;
  title: string;
  path: string;
  /** Carried through from BaseContentEntity when the source entity sets
   *  them (Phase 3 Entity Expansion) — undefined for entities that don't,
   *  including every Tool (Tools don't carry difficulty/searchIntent).
   *  Optional so every existing `resolveEntity`/`resolveEntities` caller
   *  keeps working unchanged; only the Learning Path feature reads these. */
  difficulty?: import("./types").ContentDifficulty;
  searchIntent?: import("./types").SearchIntent;
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
  "industry",
  "checklist",
  "template",
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
  entities: readonly {
    id: string;
    title: string;
    path: string;
    difficulty?: ResolvedEntity["difficulty"];
    searchIntent?: ResolvedEntity["searchIntent"];
  }[]
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
    ENTITY_INDEX.set(entity.id, {
      type,
      id: entity.id,
      title: entity.title,
      path: entity.path,
      difficulty: entity.difficulty,
      searchIntent: entity.searchIntent,
    });
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
register("industry", INDUSTRIES);
register("learning-resource", GLOSSARY);
register("checklist", CHECKLISTS);
register("template", TEMPLATES);

/**
 * Collects every EntityRef in the graph, tagged with the entity that owns
 * it — the one place that knows how to walk every content type's
 * relationship fields. Used by both build-time validation and the runtime
 * backlink index below, so a new content type's relationship fields are
 * wired into graph traversal (validation *and* "what links here") from a
 * single edit, not two.
 */
function collectAllRefs(): { source: string; ref: EntityRef }[] {
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
  for (const industry of INDUSTRIES) {
    collect(industry.id, industry.related);
    collect(
      industry.id,
      industry.recommendedTools.map((r) => r.tool)
    );
  }
  for (const entry of GLOSSARY) collect(entry.id, entry.related);
  for (const checklist of CHECKLISTS) {
    collect(checklist.id, checklist.related);
    collect(
      checklist.id,
      checklist.items.map((item) => item.tool).filter((ref): ref is EntityRef => ref !== undefined)
    );
  }

  for (const template of TEMPLATES) collect(template.id, template.related);

  return allRefs;
}

const ALL_REFS = collectAllRefs();

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

  for (const { source, ref } of ALL_REFS) {
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
  // not fatal — deliberately a visibility aid, not a build gate, since a
  // brand-new content type's entities are expected to start as orphans
  // until something links to them.
  const referenced = new Set(ALL_REFS.map((r) => r.ref.id));
  const orphans = [...ENTITY_INDEX.keys()].filter((id) => !referenced.has(id));
  if (orphans.length > 0) {
    console.warn(
      `[content graph] ${orphans.length} entities have no incoming references yet: ${orphans.join(", ")}`
    );
  }
}

validateContentGraph();

/**
 * Reverse index: entity id -> every entity that references it. This is
 * what makes the graph bidirectional — every content type above already
 * declares its *outgoing* relationships (`related`, `items`, `contains`,
 * `recommendedTools`, etc.); this derives the *incoming* direction from
 * that same data instead of requiring every entity to redundantly declare
 * both directions by hand (which would itself be a duplicate-data risk —
 * the two directions could silently drift out of sync).
 */
const BACKLINK_INDEX = new Map<string, ResolvedEntity[]>();
// Tracks (source, target) pairs already recorded — a single entity often
// references the same target through more than one field (e.g. a
// Comparison's `items` and `related` typically overlap), which would
// otherwise count as multiple separate backlinks instead of one real
// relationship between two entities.
const seenPairs = new Set<string>();
for (const { source, ref } of ALL_REFS) {
  const pairKey = `${source}->${ref.id}`;
  if (seenPairs.has(pairKey)) continue;
  seenPairs.add(pairKey);

  const sourceEntity = ENTITY_INDEX.get(source);
  if (!sourceEntity) continue; // source is always a valid id by construction above
  const existing = BACKLINK_INDEX.get(ref.id) ?? [];
  existing.push(sourceEntity);
  BACKLINK_INDEX.set(ref.id, existing);
}

/**
 * Every entity that links *to* the given one — the reverse of
 * `resolveEntities`. Powers "what else mentions this tool/guide/industry"
 * without any content type needing to hand-maintain a `linkedFrom` list.
 */
export function getBacklinks(id: string): ResolvedEntity[] {
  return BACKLINK_INDEX.get(id) ?? [];
}

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
