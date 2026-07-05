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
  | "learning-resource";

/**
 * A pointer to any entity, regardless of type. This is the one shape every
 * cross-type relationship is expressed with — "no hardcoded relationships"
 * means every page's `related` field is just EntityRef[], resolved generically
 * by src/lib/content/registry.ts rather than by per-page-type link logic.
 */
export interface EntityRef {
  type: ContentType;
  path: string;
}

/**
 * The common shape every content entity is expected to provide. Tool
 * (src/lib/tools.ts) already satisfies this structurally without being
 * rewritten to extend it — this interface describes the contract new
 * entity types should follow, not a base class new types must inherit from.
 */
export interface BaseContentEntity {
  type: ContentType;
  slug: string;
  path: string;
  title: string;
  description: string;
  related?: EntityRef[];
}
