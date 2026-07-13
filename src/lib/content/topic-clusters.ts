import type { ContentDifficulty, EntityRef } from "./types";
import { resolveEntity, type ResolvedEntity } from "./registry";
import { getEntityPriority } from "./priority";

export interface TopicCluster {
  id: string;
  name: string;
  /** The cluster's main page — always an already-real, already-valuable
   *  entity (a Tool page, in both clusters below), never a new blank page
   *  created just to have something to point at. A cluster is a grouping
   *  of existing content, not a new content type with its own route. */
  pillar: EntityRef;
  supporting: EntityRef[];
}

/**
 * Topical Authority Engine — Phase 3 Growth Engine. Real, working
 * infrastructure. 7 clusters populated as of this sprint (OCR, PDF
 * Compression, PDF Editing, Images, Word, Document Conversion, Scanning)
 * of the ~15 named across Phase 3 briefs. No new pages were created to
 * populate any of them — every member already existed from earlier
 * phases or prior Phase 3 Content Engine work; this file only adds the
 * *grouping*.
 *
 * Deliberately NOT built: Excel and PowerPoint (each has exactly one real
 * tool and no supporting guide/comparison/use-case content yet — a
 * "cluster" of one item plus a category link isn't a real cluster, it's
 * padding); Accessibility, Business Documents, Security, AI (zero real
 * content exists for any of these today — Security and AI are
 * intentionally architecture-only per `security-engine.ts`/`ai-engine.ts`,
 * so there is nothing genuine to cluster yet). Fabricating placeholder
 * members for any of these to hit a cluster count would be exactly the
 * "assembling a plausible-looking list" this file's discipline exists to
 * avoid.
 */
export const TOPIC_CLUSTERS: readonly TopicCluster[] = [
  {
    id: "topic-ocr",
    name: "OCR",
    pillar: { type: "tool", id: "tool-ocr-pdf" },
    supporting: [
      { type: "tool", id: "tool-ocr-image" },
      { type: "learning-resource", id: "learning-resource-what-is-ocr" },
      { type: "comparison", id: "comparison-ocr-pdf-vs-ocr-image" },
      { type: "use-case", id: "use-case-turn-handwritten-notes-into-searchable-text" },
      { type: "industry", id: "industry-education" },
    ],
  },
  {
    id: "topic-pdf-compression",
    name: "PDF Compression",
    pillar: { type: "tool", id: "tool-compress-pdf" },
    supporting: [
      { type: "guide", id: "guide-how-pdf-compression-works" },
      { type: "guide", id: "guide-lossy-vs-lossless-pdf-compression" },
      { type: "comparison", id: "comparison-compress-pdf-vs-split-pdf" },
      { type: "use-case", id: "use-case-compress-a-resume-for-email" },
      { type: "category", id: "category-optimize" },
      { type: "help", id: "help-why-is-my-compressed-pdf-blurry" },
      { type: "help", id: "help-best-compression-setting-for-email" },
      { type: "checklist", id: "checklist-pdf-compression" },
    ],
  },
  {
    id: "topic-pdf-editing",
    name: "PDF Editing",
    pillar: { type: "category", id: "category-pdf-editing-tools" },
    supporting: [
      { type: "tool", id: "tool-watermark-pdf" },
      { type: "tool", id: "tool-crop-pdf" },
      { type: "tool", id: "tool-fill-pdf" },
      { type: "tool", id: "tool-flatten-pdf" },
      { type: "tool", id: "tool-insert-pages" },
      { type: "tool", id: "tool-compare-pdf" },
      { type: "tool", id: "tool-pdf-metadata-editor" },
      { type: "learning-resource", id: "learning-resource-what-is-flattening-a-pdf" },
    ],
  },
  {
    id: "topic-images",
    name: "Images",
    pillar: { type: "tool", id: "tool-convert-image" },
    supporting: [
      { type: "tool", id: "tool-resize-image" },
      { type: "tool", id: "tool-crop-image" },
      { type: "tool", id: "tool-rotate-image" },
      { type: "tool", id: "tool-compress-image" },
      { type: "tool", id: "tool-image-metadata" },
      { type: "tool", id: "tool-heic-to-jpg" },
      { type: "tool", id: "tool-heic-to-png" },
      { type: "tool", id: "tool-image-watermark" },
      { type: "tool", id: "tool-svg-to-pdf" },
      { type: "learning-resource", id: "learning-resource-what-is-dpi" },
      { type: "learning-resource", id: "learning-resource-what-is-a-rasterized-pdf" },
      { type: "learning-resource", id: "learning-resource-what-is-heic" },
      { type: "learning-resource", id: "learning-resource-vector-vs-raster-images" },
      { type: "guide", id: "guide-how-heic-photo-conversion-works" },
      { type: "guide", id: "guide-how-image-watermarking-works" },
      { type: "comparison", id: "comparison-heic-to-jpg-vs-heic-to-png" },
      { type: "checklist", id: "checklist-heic-photo-conversion" },
      { type: "use-case", id: "use-case-prepare-iphone-photos-for-a-website" },
      { type: "use-case", id: "use-case-watermark-photos-before-sharing-proofs" },
    ],
  },
  {
    id: "topic-word",
    name: "Word",
    pillar: { type: "tool", id: "tool-word-to-pdf" },
    supporting: [
      { type: "tool", id: "tool-pdf-to-word" },
      { type: "tool", id: "tool-docx-merge" },
      { type: "comparison", id: "comparison-pdf-to-word-vs-word-to-pdf" },
    ],
  },
  {
    id: "topic-document-conversion",
    name: "Document Conversion",
    pillar: { type: "category", id: "category-document-conversion-tools" },
    supporting: [
      { type: "tool", id: "tool-word-to-pdf" },
      { type: "tool", id: "tool-pdf-to-word" },
      { type: "tool", id: "tool-pdf-to-powerpoint" },
      { type: "tool", id: "tool-powerpoint-to-pdf" },
      { type: "tool", id: "tool-excel-to-pdf" },
    ],
  },
  {
    id: "topic-data-conversion",
    name: "Data Conversion (CSV/Excel/XML)",
    pillar: { type: "category", id: "category-data-conversion-tools" },
    supporting: [
      { type: "tool", id: "tool-csv-to-xml" },
      { type: "tool", id: "tool-xml-to-csv" },
      { type: "tool", id: "tool-excel-to-xml" },
      { type: "tool", id: "tool-xml-to-excel" },
      { type: "guide", id: "guide-how-csv-excel-xml-conversion-works" },
      { type: "comparison", id: "comparison-csv-to-xml-vs-excel-to-xml" },
      { type: "use-case", id: "use-case-prepare-a-spreadsheet-export-for-a-data-import" },
      { type: "learning-resource", id: "learning-resource-what-is-xml" },
      { type: "industry", id: "industry-accounting-finance" },
    ],
  },
  {
    id: "topic-scanning",
    name: "Scanning",
    pillar: { type: "tool", id: "tool-jpg-to-pdf" },
    supporting: [
      { type: "tool", id: "tool-ocr-image" },
      { type: "tool", id: "tool-ocr-pdf" },
      { type: "guide", id: "guide-how-jpg-to-pdf-conversion-works" },
      { type: "use-case", id: "use-case-combine-scanned-photos-into-a-single-pdf" },
      { type: "industry", id: "industry-education" },
    ],
  },
];

export function getClusterForEntity(entityId: string): TopicCluster | undefined {
  return TOPIC_CLUSTERS.find(
    (cluster) => cluster.pillar.id === entityId || cluster.supporting.some((ref) => ref.id === entityId)
  );
}

/** Every other member of the entity's cluster (pillar + supporting, minus
 *  the entity itself) — the real payload for an "Explore this topic"
 *  section, resolved to renderable entities the same way every other
 *  related-content list in this codebase is. */
export function getClusterMembers(entityId: string): ResolvedEntity[] {
  const cluster = getClusterForEntity(entityId);
  if (!cluster) return [];

  const allRefs = [cluster.pillar, ...cluster.supporting];
  return allRefs
    .filter((ref) => ref.id !== entityId)
    .map(resolveEntity)
    .filter((entity): entity is ResolvedEntity => entity !== undefined);
}

const DIFFICULTY_ORDER: Record<ContentDifficulty, number> = { beginner: 1, intermediate: 2, advanced: 3 };

/**
 * Orders a cluster's members that actually carry a `difficulty` (Tools
 * and most pre-existing content don't set one — see the note on
 * `ResolvedEntity` in registry.ts) from beginner to advanced. Real,
 * computed ordering, not a hand-authored "path" — a member with no
 * difficulty set is excluded rather than guessed at, so a cluster with
 * only one or two rated members simply returns a short (or empty) path
 * instead of a padded-out fake one.
 */
export function getLearningPath(clusterId: string): ResolvedEntity[] {
  const cluster = TOPIC_CLUSTERS.find((c) => c.id === clusterId);
  if (!cluster) return [];

  const allRefs = [cluster.pillar, ...cluster.supporting];
  const rated = allRefs
    .map(resolveEntity)
    .filter((entity): entity is ResolvedEntity => entity !== undefined && entity.difficulty !== undefined);

  return [...rated].sort((a, b) => DIFFICULTY_ORDER[a.difficulty!] - DIFFICULTY_ORDER[b.difficulty!]);
}

/**
 * Ranks a cluster's members by the same real, computed priority score
 * used across the platform (backlink count + pillar status + tool
 * status) — not a separate invented "popularity" number. This is what
 * "Popular in Topic" honestly means without real click/usage data: which
 * members the graph itself treats as most load-bearing.
 */
export function getPopularInTopic(clusterId: string): ResolvedEntity[] {
  const cluster = TOPIC_CLUSTERS.find((c) => c.id === clusterId);
  if (!cluster) return [];

  const allRefs = [cluster.pillar, ...cluster.supporting];
  const members = allRefs.map(resolveEntity).filter((entity): entity is ResolvedEntity => entity !== undefined);
  const score = (entityId: string) =>
    getEntityPriority(entityId, { isClusterPillar: entityId === cluster.pillar.id }).score;

  return [...members].sort((a, b) => score(b.id) - score(a.id));
}

/** Whether an entity is the pillar of *any* cluster — the one place that
 *  needs the global answer (priority.ts intentionally only knows about a
 *  single cluster's pillar at a time, supplied by its caller, to avoid
 *  importing this module back). */
export function isAnyClusterPillar(entityId: string): boolean {
  return TOPIC_CLUSTERS.some((cluster) => cluster.pillar.id === entityId);
}
