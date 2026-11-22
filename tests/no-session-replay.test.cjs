const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(file, injectedRequire = require) {
  const { outputText } = ts.transpileModule(read(file), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const mod = { exports: {} };
  Function('require', 'module', 'exports', '__dirname', outputText)(
    injectedRequire, mod, mod.exports, root
  );
  return mod.exports;
}

test('the actual analytics wrapper mounts GA alone, even with a legacy replay setting', () => {
  const env = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = 'synthetic-old-configuration';
  try {
    const GoogleAnalytics = () => null;
    const imports = [];
    const analytics = load('src/components/analytics/index.tsx', id => {
      imports.push(id);
      if (id === './GoogleAnalytics') return { GoogleAnalytics };
      assert.equal(id, 'react/jsx-runtime');
      return require(id);
    });
    assert.equal(analytics.Analytics().type, GoogleAnalytics);
    assert.deepEqual(Object.keys(analytics).sort(), ['Analytics', 'GoogleAnalytics']);
    assert.deepEqual(imports.sort(), ['./GoogleAnalytics', 'react/jsx-runtime']);
    assert.equal(fs.existsSync(path.join(root, 'src/components/analytics/Clarity.tsx')), false);
    assert.match(read('src/components/DocumentShell.tsx'), /<Analytics\s*\/>/);
  } finally {
    if (env === undefined) delete process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    else process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = env;
  }
});

test('English Privacy disclosure resolves through the existing resource translator in every existing policy locale', () => {
  const english = read('src/app/(english)/privacy/page.tsx').match(/<p>(The site uses Google Analytics[^<]+)<\/p>/)?.[1];
  assert.ok(english);
  const { resourceText } = load('src/lib/i18n/resource-text.ts');
  const dir = path.join(root, 'src/lib/i18n/resources');
  const locales = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  assert.deepEqual(locales, ['ar', 'de', 'es', 'fr', 'hi', 'id', 'ja', 'ko', 'pt-BR', 'ru', 'zh-CN'].map(x => x + '.json'));
  for (const locale of locales) {
    const dictionary = JSON.parse(fs.readFileSync(path.join(dir, locale), 'utf8'));
    const translation = resourceText(dictionary, english);
    assert.notEqual(translation, english, locale);
    assert.match(translation, /Google Analytics|Google アナリティクス/, locale);
    assert.doesNotMatch(translation, /Microsoft|Clarity/, locale);
    assert.equal(Object.keys(dictionary).some(key => key.includes('Microsoft Clarity')), false, locale);
  }
});
