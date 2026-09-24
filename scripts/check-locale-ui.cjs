const assert = require("node:assert/strict");
const { loadTs } = require("../tests/load-ts.cjs");
const { LAUNCH_TOOL_SLUGS } = loadTs("src/lib/launch-catalog.ts");
const { getActiveLocales } = loadTs("src/lib/i18n/locales.ts");
const { CORE_PAGE_PATHS } = loadTs("src/lib/i18n/core-content.ts");
const base = process.argv[2] || "http://127.0.0.1:4320";

function route(slug, locale) {
  if (locale.code === "en") return slug ? `/${slug}` : "/";
  const key = Object.entries(CORE_PAGE_PATHS.en).find(([, value]) => value === slug)?.[0];
  const path = key ? CORE_PAGE_PATHS[locale.code][key] : slug;
  return `/${locale.segment}${path ? `/${path}` : ""}`;
}

async function check(url) {
  const response = await fetch(base + url, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, url);
  const html = await response.text();
  const begin = html.indexOf('<main id="main-content"');
  assert.ok(begin > 0, url);
  const content = html.slice(begin, html.indexOf("</main>", begin));
  assert.ok(content.includes("<h1"), `missing heading: ${url}`);
  // Compare actual application markup, not translated text or JSON-LD.
  return {
    classes: [...content.matchAll(/class="([^"]*)"/g)].map((m) => m[1]),
    inputs: [...content.matchAll(/<input\b[^>]*>/g)].map((m) => ({
      type: /type="([^"]*)"/.exec(m[0])?.[1], accept: /accept="([^"]*)"/.exec(m[0])?.[1], multiple: /\bmultiple/.test(m[0]),
    })),
    buttons: [...content.matchAll(/<button\b/g)].length,
    lang: /<html[^>]*lang="([^"]*)"/.exec(html)?.[1],
  };
}

(async () => {
  let pages = 0;
  for (const slug of ["", ...LAUNCH_TOOL_SLUGS]) {
    const reference = await check(slug ? `/${slug}` : "/");
    pages++;
    for (const locale of getActiveLocales().filter((locale) => locale.code !== "en")) {
      const url = route(slug, locale);
      const actual = await check(url);
      assert.equal(actual.lang, locale.code, `${url}: document language`);
      assert.deepEqual(actual.classes, reference.classes, `${url}: layout classes differ from English`);
      assert.deepEqual(actual.inputs, reference.inputs, `${url}: file input capabilities differ from English`);
      assert.equal(actual.buttons, reference.buttons, `${url}: controls differ from English`);
      pages++;
    }
    console.log(`PASS ${slug || "home"}: 12 languages, identical initial layout and controls`);
  }
  console.log(JSON.stringify({ base, pages, languages: 12, tools: 26, result: "passed", scope: "HTTP rendering, initial UI structure and input parity; not all document output formats" }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
