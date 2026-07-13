#!/usr/bin/env node
/**
 * Content Gap Engine v2 — Phase 3 Growth Engine. Reports real, structural
 * coverage gaps computed from the actual registries. Does NOT suggest
 * specific new page titles or topics — inventing "you should write X"
 * content ideas without the research behind them would be fabrication.
 * This reports *where* coverage is thin; a human still decides *what*
 * real content fills it.
 *
 * Run with: npx tsx scripts/content-expansion-report.mjs
 * Writes reports/content-gap-report.json and reports/content-gap-report.md
 * in addition to the console summary.
 */
import { writeFileSync, mkdirSync } from "fs";

const NAMED_CLUSTER_TOPICS = [
  "PDF", "OCR", "Images", "Word", "PowerPoint", "Excel", "Document Conversion",
  "Compression", "Editing", "Metadata", "Scanning", "Accessibility",
  "Business Documents", "Security", "AI",
];

async function main() {
  const { TOOLS } = await import("../src/lib/tools.ts");
  const { COMPARISONS } = await import("../src/lib/content/comparisons.ts");
  const { INDUSTRIES } = await import("../src/lib/content/industries.ts");
  const { CATEGORIES } = await import("../src/lib/content/categories.ts");
  const { CHECKLISTS } = await import("../src/lib/content/checklists.ts");
  const { TOPIC_CLUSTERS } = await import("../src/lib/content/topic-clusters.ts");
  const { getBacklinks } = await import("../src/lib/content/registry.ts");

  const comparisonToolIds = new Set(COMPARISONS.flatMap((c) => c.items.filter((i) => i.type === "tool").map((i) => i.id)));
  const industryToolIds = new Set(INDUSTRIES.flatMap((i) => i.recommendedTools.map((r) => r.tool.id)));
  const categoryToolIds = new Set(CATEGORIES.flatMap((c) => c.contains.filter((i) => i.type === "tool").map((i) => i.id)));
  const clusteredToolIds = new Set(
    TOPIC_CLUSTERS.flatMap((c) => [c.pillar, ...c.supporting]).filter((r) => r.type === "tool").map((r) => r.id)
  );

  const toolRows = TOOLS.map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    backlinks: getBacklinks(tool.id).length,
    inComparison: comparisonToolIds.has(tool.id),
    inIndustry: industryToolIds.has(tool.id),
    inCategory: categoryToolIds.has(tool.id),
    inCluster: clusteredToolIds.has(tool.id),
  }));

  // Substring match, not exact equality — this project's actual cluster
  // names are more specific than the brief's bare topic list ("PDF
  // Compression" vs. "Compression"), and an exact-string check flagged
  // those as false-positive gaps on the first run of this script.
  const builtClusterNames = TOPIC_CLUSTERS.map((c) => c.name.toLowerCase());
  const missingClusters = NAMED_CLUSTER_TOPICS.filter(
    (name) => !builtClusterNames.some((built) => built.includes(name.toLowerCase()))
  );

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      tools: TOOLS.length,
      comparisons: COMPARISONS.length,
      industries: INDUSTRIES.length,
      categories: CATEGORIES.length,
      checklists: CHECKLISTS.length,
      topicClusters: TOPIC_CLUSTERS.length,
    },
    tools: {
      zeroBacklinks: toolRows.filter((r) => r.backlinks === 0).map((r) => r.slug),
      noComparison: toolRows.filter((r) => !r.inComparison).map((r) => r.slug),
      noIndustry: toolRows.filter((r) => !r.inIndustry).map((r) => r.slug),
      noCategory: toolRows.filter((r) => !r.inCategory).map((r) => r.slug),
      noCluster: toolRows.filter((r) => !r.inCluster).map((r) => r.slug),
    },
    missingTopicClusters: missingClusters,
    missingTemplates: "No Template content type entries exist to report on — see checklists.ts's sibling, templates.ts, if/when built.",
    missingSchema: "None — every registered ContentType has a schema case in content/seo.ts's exhaustive switch (TypeScript enforces this at compile time).",
    note: "This is a coverage map computed from real registry data, not a generated content backlog. Each gap needs real, researched content — not a placeholder.",
  };

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/content-gap-report.json", JSON.stringify(report, null, 2));

  const md = [
    `# Content Gap Report`,
    ``,
    `Generated: ${report.generatedAt}`,
    ``,
    `## Totals`,
    ...Object.entries(report.totals).map(([k, v]) => `- ${k}: ${v}`),
    ``,
    `## Tools with zero backlinks (${report.tools.zeroBacklinks.length}/${TOOLS.length})`,
    ...report.tools.zeroBacklinks.map((s) => `- ${s}`),
    ``,
    `## Tools with no comparison page (${report.tools.noComparison.length}/${TOOLS.length})`,
    ...report.tools.noComparison.map((s) => `- ${s}`),
    ``,
    `## Tools with no industry recommendation (${report.tools.noIndustry.length}/${TOOLS.length})`,
    ...report.tools.noIndustry.map((s) => `- ${s}`),
    ``,
    `## Tools with no category (${report.tools.noCategory.length}/${TOOLS.length})`,
    ...report.tools.noCategory.map((s) => `- ${s}`),
    ``,
    `## Tools with no topic cluster (${report.tools.noCluster.length}/${TOOLS.length})`,
    ...report.tools.noCluster.map((s) => `- ${s}`),
    ``,
    `## Missing named topic clusters (${missingClusters.length}/${NAMED_CLUSTER_TOPICS.length})`,
    ...missingClusters.map((s) => `- ${s}`),
    ``,
    `## Missing Templates`,
    report.missingTemplates,
    ``,
    `## Missing Schema`,
    report.missingSchema,
    ``,
    `> ${report.note}`,
  ].join("\n");
  writeFileSync("reports/content-gap-report.md", md);

  console.log(`\n=== Content Gap Report — ${TOOLS.length} tools, ${TOPIC_CLUSTERS.length}/${NAMED_CLUSTER_TOPICS.length} clusters ===\n`);
  console.log(`Zero backlinks: ${report.tools.zeroBacklinks.length}, no comparison: ${report.tools.noComparison.length}, no industry: ${report.tools.noIndustry.length}, no category: ${report.tools.noCategory.length}, no cluster: ${report.tools.noCluster.length}`);
  console.log(`Missing clusters: ${missingClusters.join(", ")}`);
  console.log(`\nWritten to reports/content-gap-report.json and reports/content-gap-report.md\n`);
}

main();
