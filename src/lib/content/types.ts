/**
 * The full set of page types the Growth Architecture is designed to support.
 * Not every type has real content or a route yet — see src/lib/content's
 * README-equivalent notes in the Sprint 5.0 report for what's implemented
 * vs. reserved for later.
 */
export type ContentType =
  | "tool"
  | "category"
  | "guide"
  | "comparison"
  | "use-case"
  | "help"
  | "faq"
  | "learning-resource"
  | "industry"
  | "checklist"
  | "template";

/**
 * A pointer to any entity, regardless of type. This is the one shape every
 * cross-type relationship is expressed with — "no hardcoded relationships"
 * means every page's `related` field is just EntityRef[], resolved generically
 * by src/lib/content/registry.ts rather than by per-page-type link logic.
 *
 * Resolved by stable `id`, not `path` (Sprint 6.1) — a relationship must
 * survive a future URL change; a path-based join could not.
 */
export interface EntityRef {
  type: ContentType;
  id: string;
}

/**
 * The common shape every content entity is expected to provide. Tool
 * (src/lib/tools.ts) already satisfies this structurally without being
 * rewritten to extend it — this interface describes the contract new
 * entity types should follow, not a base class new types must inherit from.
 *
 * `id` is immutable and internal-only: human-readable, deterministic
 * (`{type}-{slug}`), never derived from route params or regenerated. It
 * exists purely so relationships survive a slug/path change; `path` still
 * governs the actual URL, canonical, and routing exactly as before.
 */
/** Real, established SEO taxonomy for what a searcher wants when they
 *  type a query that would land on this page — not a PDFPilot invention.
 *  Optional: only worth setting where it's genuinely unambiguous (a
 *  glossary definition is informational; a tool page is transactional). */
export type SearchIntent = "informational" | "navigational" | "transactional" | "commercial";

/** How much prior knowledge the content assumes. Optional and, like
 *  `searchIntent`, only meaningful for content types where it varies
 *  page-to-page — a Tool isn't "beginner" or "advanced," a Guide can be. */
export type ContentDifficulty = "beginner" | "intermediate" | "advanced";

/**
 * The common shape every content entity is expected to provide. Tool
 * (src/lib/tools.ts) already satisfies this structurally without being
 * rewritten to extend it — this interface describes the contract new
 * entity types should follow, not a base class new types must inherit from.
 *
 * `id` is immutable and internal-only: human-readable, deterministic
 * (`{type}-{slug}`), never derived from route params or regenerated. It
 * exists purely so relationships survive a slug/path change; `path` still
 * governs the actual URL, canonical, and routing exactly as before.
 */
export interface BaseContentEntity {
  type: ContentType;
  id: string;
  slug: string;
  path: string;
  title: string;
  description: string;
  related?: EntityRef[];
  /** Optional, additive (Phase 3 Growth Engine) — not populated on every
   *  entity, and not required to be. `related` already covers "what this
   *  connects to" for every existing content type; these three exist for
   *  facets `related` genuinely can't express: search intent, reading
   *  level, and topic-cluster hierarchy (`parentTopic` points at the
   *  cluster's pillar page — see topic-clusters.ts). */
  searchIntent?: SearchIntent;
  difficulty?: ContentDifficulty;
  parentTopic?: EntityRef;
}
