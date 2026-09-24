// Prints a reviewable patch; never edits files or converts document strings.
const fs = require("node:fs");
const ts = require("typescript");
const { createPatch } = require("diff");
const { loadTs } = require("../tests/load-ts.cjs");
const { uiText } = loadTs("src/lib/i18n/ui-copy.ts");
const { LAUNCH_TOOL_SLUGS } = loadTs("src/lib/launch-catalog.ts");
const files = LAUNCH_TOOL_SLUGS.map((slug) => `src/app/${slug}/${slug}-client.tsx`);
const patches = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  function visit(node) {
    if (ts.isJsxText(node)) {
      const original = source.slice(node.pos, node.end);
      const text = original.replace(/\s+/g, " ").trim();
      if (text && uiText("hi", text) !== text) {
        const prefix = original.match(/^\s*/)[0];
        const suffix = original.match(/\s*$/)[0];
        edits.push({ start: node.pos, end: node.end, value: `${prefix}<UiText text=${JSON.stringify(text)} />${suffix}` });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!edits.length) continue;
  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
  if (!source.includes('import { UiText')) result = result.replace('"use client";', '"use client";\n\nimport { UiText } from "@/components/i18n/UiText";');
  const hunks = createPatch(file, source, result, "", "", { context: 1 }).split("\n").slice(4).filter((line) => !line.startsWith("\\ No newline")).join("\n").replace(/^@@.*@@$/gm, "@@");
  patches.push(`*** Update File: ${process.cwd()}/${file}\n${hunks}`);
}
process.stdout.write(`*** Begin Patch\n${patches.join("")}*** End Patch`);
