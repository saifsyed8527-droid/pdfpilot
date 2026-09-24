const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { loadTs } = require("./load-ts.cjs");
const { LAUNCH_TOOL_SLUGS } = loadTs("src/lib/launch-catalog.ts");
const { getActiveLocales } = loadTs("src/lib/i18n/locales.ts");
const { localizedToolName, uiText, validateUiCopy } = loadTs("src/lib/i18n/ui-copy.ts");
const { localizedToolSummary, validateToolSummaries } = loadTs("src/lib/i18n/tool-summaries.ts");

test("all existing languages have complete catalog and shared UI dictionaries", () => {
  assert.equal(getActiveLocales().length, 12);
  assert.deepEqual(validateUiCopy(), []);
  assert.deepEqual(validateToolSummaries(), []);
  assert.deepEqual(loadTs("src/lib/i18n/home-copy.ts").validateHomeCopy(), []);
  assert.deepEqual(loadTs("src/lib/i18n/workspace-copy.ts").validateWorkspaceCopy(), []);
  for (const locale of getActiveLocales().filter((l) => l.code !== "en")) {
    for (const slug of LAUNCH_TOOL_SLUGS) {
      assert.ok(localizedToolName(slug, locale.code, "MISSING"));
      assert.notEqual(localizedToolName(slug, locale.code, "MISSING"), "MISSING");
      assert.notEqual(localizedToolSummary(slug, locale.code, "MISSING"), "MISSING");
    }
    assert.notEqual(uiText(locale.code, "Back to Home"), "Back to Home");
  }
  assert.equal(uiText("en", "Any existing English wording"), "Any existing English wording");
});

test("functional navigation contains each approved tool exactly once", () => {
  const source = fs.readFileSync("src/lib/tool-navigation.ts", "utf8");
  const groupBlock = source.split("export const TOOL_NAV_GROUPS = ")[1].split("] as const;")[0];
  const slugs = [...groupBlock.matchAll(/"([a-z]+(?:-[a-z]+)+)"/g)].map((match) => match[1]);
  assert.deepEqual(slugs.sort(), [...LAUNCH_TOOL_SLUGS].sort());
  assert.equal(new Set(slugs).size, 26);
  const navbar = fs.readFileSync("src/components/navbar.tsx", "utf8");
  assert.ok(navbar.includes("TOOL_NAVIGATION.map"));
  assert.ok(!navbar.includes("Tools ${start"));
});

test("every localized tool reuses the exact English workspace and props", () => {
  const registry = fs.readFileSync("src/lib/i18n/tool-workspaces.ts", "utf8");
  for (const slug of LAUNCH_TOOL_SLUGS) {
    const page = fs.readFileSync(`src/app/${slug}/page.tsx`, "utf8");
    const shared = fs.readFileSync(`src/app/${slug}/tool-page.tsx`, "utf8");
    assert.match(page, /export \{ metadata, default \} from "\.\/tool-page"/);
    assert.ok(shared.includes("<ToolWorkspace />"), slug);
    assert.ok(shared.includes("export function ToolWorkspace"), slug);
    assert.ok(registry.includes(`@/app/${slug}/tool-page`), slug);
  }
  const localized = fs.readFileSync("src/components/i18n/LocalizedCorePages.tsx", "utf8");
  assert.ok(localized.includes("<HomeClient"));
  assert.ok(!localized.includes("<section"), "no alternate landing UI");
  assert.ok(!localized.includes("labels.useTool"), "no extra Open tool gate");
});

test("dark surfaces are theme driven, without white inline gradients", () => {
  for (const path of ["src/components/tool/PdfToolChrome.tsx", "src/app/html-to-pdf/html-to-pdf-client.tsx"]) {
    const source = fs.readFileSync(path, "utf8");
    assert.ok(source.includes("pdf-tool-landing"));
    assert.ok(!source.includes("linear-gradient(to bottom, #f8fafc, #ffffff)"));
  }
  const css = fs.readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /\.dark \.pdf-tool-landing\s*\{[^}]*background-image: radial-gradient[^}]*\}/);
});

test("locale does not leak into document transformation code", () => {
  const link = fs.readFileSync("src/components/i18n/LocaleLink.tsx", "utf8");
  assert.ok(link.includes("isLaunchTool(path.slice(1))"));
  for (const file of ["src/components/i18n/UiText.tsx", "src/lib/i18n/ui-copy.ts", "src/lib/i18n/tool-summaries.ts"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.ok(!source.includes("fetch("));
    assert.ok(!source.includes("MutationObserver"));
    assert.ok(!source.includes("innerHTML"));
  }
});

test("client language navigation updates page language and scroll hint reaches its end", () => {
  const navbar = fs.readFileSync("src/components/navbar.tsx", "utf8");
  assert.ok(navbar.includes("document.documentElement.lang = locale.code"));
  assert.ok(navbar.includes("document.documentElement.dir = locale.dir"));
  assert.ok(navbar.includes("[parsedPath.locale]"));
  assert.ok(navbar.includes("el.scrollHeight - el.clientHeight - el.scrollTop > 4"));
});
