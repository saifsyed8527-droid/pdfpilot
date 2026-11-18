const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
function route(contentType, body) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync("src/app/api/html-to-pdf/asset/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  assert.equal((source.diagnostics || []).length, 0);
  const deps = {
    "next/server": { NextResponse: class extends Response { static json(body, init) { return new Response(JSON.stringify(body), init); } } },
    "@/lib/server/safe-public-fetch": { safePublicFetch: async () => ({ bytes: new TextEncoder().encode(body), contentType, finalUrl: "https://example.test/styles/main.css" }) },
    "@/lib/server/request-guard": { checkRateLimit: () => ({ allowed: true }) },
  };
  new Function("require", "module", "exports", source.outputText)((name) => { assert.ok(deps[name], name); return deps[name]; }, module, module.exports);
  return module.exports.GET(new Request("https://pdfpilot.test/api/html-to-pdf/asset?url=https%3A%2F%2Fexample.test%2Fasset"));
}
for (const payload of ['<svg xmlns="http://www.w3.org/2000/svg"><script>window.__unsafe=true</script></svg>', '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__unsafe=true"/>']) {
  test("SVG active content is constrained by response sandbox", async () => {
    const res = await route("image/svg+xml", payload);
    assert.equal(res.status, 200);
    const policy = res.headers.get("content-security-policy");
    assert.match(policy, /(?:^|;)\s*sandbox\s*(?:;|$)/);
    assert.doesNotMatch(policy, /allow-scripts|allow-same-origin/);
    assert.match(policy, /default-src 'none'/);
    assert.equal(await res.text(), payload);
  });
}
for (const type of ["image/png", "image/jpeg", "font/woff2", "application/octet-stream"]) {
  test("passive asset bytes and MIME preserved: " + type, async () => {
    const res = await route(type, "passive-bytes");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), type);
    assert.equal(await res.text(), "passive-bytes");
    assert.match(res.headers.get("content-security-policy"), /^sandbox;/);
  });
}
test("CSS still rewrites dependent assets", async () => {
  const res = await route("text/css", 'body{background:url("../image.png")}');
  assert.equal(res.headers.get("content-type"), "text/css");
  assert.match(await res.text(), /https:\/\/pdfpilot.test\/api\/html-to-pdf\/asset\?url=https%3A%2F%2Fexample.test%2Fimage.png/);
});
test("HTML upstream remains rejected", async () => {
  assert.equal((await route("text/html", "<script>bad()</script>")).status, 415);
});
test("Next config overrides the global page CSP for asset documents", async () => {
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync("next.config.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  new Function("require", "module", "exports", "__dirname", compiled.outputText)(require, module, module.exports, process.cwd());
  const rules = await module.exports.default.headers();
  const general = rules.findIndex(rule => rule.source === "/(.*)");
  const special = rules.findIndex(rule => rule.source === "/api/html-to-pdf/asset");
  assert.ok(special > general, "asset policy must override global CSP");
  const policy = rules[special].headers.find(header => header.key === "Content-Security-Policy").value;
  const response = await route("image/svg+xml", "<svg/>");
  assert.equal(policy, response.headers.get("content-security-policy"));
  assert.match(policy, /^sandbox;/);
});
