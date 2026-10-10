const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(source) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', '__dirname', code)(require, module, module.exports, process.cwd());
  return module.exports;
}

test('only scanner documents may request same-origin camera; unrelated sensor permissions stay denied', async () => {
  const rules = await load('next.config.ts').default.headers();
  const policy = rule => rule.headers.find(header => header.key === 'Permissions-Policy')?.value;
  assert.equal(policy(rules.find(rule => rule.source === '/(.*)')),
    'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  const overrides = rules.filter(rule => policy(rule)?.includes('camera=(self)'));
  assert.equal(overrides.length, 2);
  assert.equal(overrides[0].source, '/scan-pdf');
  const localized = /^\/:locale\(([^)]+)\)\/scan-pdf$/.exec(overrides[1].source);
  assert.ok(localized, 'camera override must be restricted to the scanner path');
  const segments = load('src/lib/i18n/locales.ts').LOCALES.filter(locale => locale.segment).map(locale => locale.segment);
  assert.deepEqual(localized[1].split('|').sort(), segments.sort());
  for (const rule of overrides) {
    assert.equal(policy(rule), 'camera=(self), microphone=(), geolocation=(), interest-cohort=()');
    assert.ok(rules.indexOf(rule) > rules.findIndex(item => item.source === '/(.*)'));
    assert.equal(rule.headers.length, 1, 'scanner camera policy must not relax CSP or other protections');
  }
});
