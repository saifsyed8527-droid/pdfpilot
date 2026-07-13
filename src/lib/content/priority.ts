import { getBacklinks } from "./registry";

export type PriorityTier = "high" | "medium" | "low";

export interface EntityPriority {
  /** Real, computed input facts — not invented. Shown alongside the score
   *  itself so a reader can see exactly what produced it. */
  backlinkCount: number;
  isClusterPillar: boolean;
  isTool: boolean;
  /** Simple weighted sum of the facts above — not a black box, and not a
   *  claim of real traffic/ranking data this project doesn't have.
   *  Content/link/SERP priority all read from the same score today
   *  because they'd need genuinely different real signals to diverge
   *  honestly (actual traffic for SERP priority, actual editorial backlog
   *  for content priority) — signals this project doesn't have yet.
   *  Splitting them into three numbers that all derive from the same one
   *  fact would imply more precision than the data supports. */
  score: number;
  tier: PriorityTier;
}

function scoreToTier(score: number): PriorityTier {
  if (score >= 10) return "high";
  if (score >= 3) return "medium";
  return "low";
}

/**
 * Computes a priority signal for any entity from real, already-derived
 * graph facts — no manually-assigned "priority: 8" field on any entity,
 * and no invented traffic/conversion numbers.
 *
 * Deliberately has no dependency on topic-clusters.ts: this module is the
 * generic, lower-level scorer; topic-clusters.ts (which already knows
 * which entity is *its own* pillar) is the caller that supplies
 * `isClusterPillar`, not the other way around. An earlier version had
 * this module import TOPIC_CLUSTERS directly to compute that fact itself
 * — verified broken (a real circular-import evaluation-order error,
 * `getPopularInTopic` in topic-clusters.ts already needs to import
 * `getEntityPriority` from here) and fixed by inverting the dependency
 * instead of working around it.
 */
export function getEntityPriority(id: string, options: { isClusterPillar?: boolean } = {}): EntityPriority {
  const backlinkCount = getBacklinks(id).length;
  const isClusterPillar = options.isClusterPillar ?? false;
  const isTool = id.startsWith("tool-");

  const score = backlinkCount * 2 + (isClusterPillar ? 10 : 0) + (isTool ? 5 : 0);

  return { backlinkCount, isClusterPillar, isTool, score, tier: scoreToTier(score) };
}
