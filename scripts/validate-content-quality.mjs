#!/usr/bin/env node
/**
 * Content Quality Engine — a real, runnable check against the actual
 * content registries (not a design doc). Run with:
 *   npx tsx scripts/validate-content-quality.mjs
 *
 * Checks the things "helpful content, not thin content" actually means
 * mechanically: minimum description length, no duplicate titles (a
 * real signal of accidental copy-paste content), every entity connected
 * to at least one other entity (an orphan page serves no discovery path
 * and no internal-linking value), and type-specific body-content checks
 * (an industry with zero recommended tools, a use-case with zero steps,
 * a comparison with zero point rows are all "the page exists but has
 * nothing in it," which is exactly what this project's "zero thin
 * content" rule means in a shape a script can actually check for).
 *
 * This does NOT check prose quality, tone, or factual accuracy — those
 * need human judgment. It catches the mechanical, structural version of
 * thin/duplicate content, which is the part that scales.
 */

const MIN_DESCRIPTION_LENGTH = 60;

async function main() {
  const { TOOLS } = await import("../src/lib/tools.ts");
  const { GUIDES } = await import("../src/lib/content/guides.ts");
  const { HELP_ENTRIES } = await import("../src/lib/content/help.ts");
  const { COMPARISONS } = await import("../src/lib/content/comparisons.ts");
  const { USE_CASES } = await import("../src/lib/content/use-cases.ts");
  const { CATEGORIES } = await import("../src/lib/content/categories.ts");
  const { INDUSTRIES } = await import("../src/lib/content/industries.ts");
  const { GLOSSARY } = await import("../src/lib/content/glossary.ts");
  const { getBacklinks } = await import("../src/lib/content/registry.ts");

  const issues = [];
  const warn = (id, message) => issues.push({ severity: "warn", id, message });
  const error = (id, message) => issues.push({ severity: "error", id, message });

  // --- Duplicate titles across the whole graph ---
  const allEntities = [
    ...TOOLS.map((t) => ({ id: t.id, title: t.name })),
    ...GUIDES.map((g) => ({ id: g.id, title: g.title })),
    ...HELP_ENTRIES.map((h) => ({ id: h.id, title: h.question })),
    ...COMPARISONS.map((c) => ({ id: c.id, title: c.title })),
    ...USE_CASES.map((u) => ({ id: u.id, title: u.title })),
    ...CATEGORIES.map((c) => ({ id: c.id, title: c.title })),
    ...INDUSTRIES.map((i) => ({ id: i.id, title: i.title })),
    ...GLOSSARY.map((g) => ({ id: g.id, title: g.title })),
  ];
  const titleOwners = new Map();
  for (const { id, title } of allEntities) {
    const owner = titleOwners.get(title);
    if (owner) error(id, `Duplicate title "${title}" also used by "${owner}".`);
    titleOwners.set(title, id);
  }

  // --- Description length (thin-content signal) ---
  for (const entity of [...COMPARISONS, ...USE_CASES, ...INDUSTRIES, ...CATEGORIES]) {
    if ((entity.description ?? "").length < MIN_DESCRIPTION_LENGTH) {
      warn(entity.id, `Description is only ${entity.description.length} chars (min ${MIN_DESCRIPTION_LENGTH}).`);
    }
  }
  for (const entry of GLOSSARY) {
    if ((entry.definition ?? "").length < 20) {
      warn(entry.id, `Definition is only ${entry.definition.length} chars — too short to be a real definition.`);
    }
  }

  // --- Type-specific "does this page actually have content" checks ---
  for (const industry of INDUSTRIES) {
    if (industry.recommendedTools.length === 0) error(industry.id, "Zero recommended tools — page has no content.");
  }
  for (const useCase of USE_CASES) {
    if (useCase.steps.length === 0) error(useCase.id, "Zero steps — page has no content.");
  }
  for (const comparison of COMPARISONS) {
    if (comparison.points.length === 0) error(comparison.id, "Zero comparison points — page has no content.");
  }
  for (const category of CATEGORIES) {
    if (category.contains.length === 0) error(category.id, "Zero contained items — page has no content.");
  }

  // --- Orphan check (every entity should be reachable from somewhere) ---
  for (const { id, title } of allEntities) {
    if (id.startsWith("tool-")) continue; // Tools are reachable via nav/footer/sitemap, not just backlinks.
    const backlinks = getBacklinks(id);
    if (backlinks.length === 0) warn(id, `"${title}" has no incoming links from other content — real, but undiscoverable except via direct URL or sitemap.`);
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warn");

  console.log(`\nContent Quality Report — ${allEntities.length} entities checked\n`);
  for (const issue of issues) {
    console.log(`${issue.severity === "error" ? "ERROR" : "WARN "}  ${issue.id}: ${issue.message}`);
  }
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).\n`);

  if (errors.length > 0) process.exit(1);
}

main();
