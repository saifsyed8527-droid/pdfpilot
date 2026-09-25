const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTs } = require('./load-ts.cjs');
const pages = require('../src/lib/content/conversion-templates.json');
const { getActiveLocales } = loadTs('src/lib/i18n/locales.ts');
const { CONVERSION_TOOL_SLUGS, CONVERSION_COPY, conversionCopy } = loadTs('src/lib/i18n/conversion-copy.ts');
const { CONVERSION_UI_KEYS, CONVERSION_UI_ROWS } = loadTs('src/lib/i18n/conversion-ui.ts');

test('three-tool templates have usable presets or sample-backed document tasks', () => {
  assert.equal(pages.length, 17);
  assert.equal(new Set(pages.map(p=>p.slug)).size, pages.length);
  assert.equal(new Set(pages.map(p=>p.title)).size, pages.length);
  assert.deepEqual(CONVERSION_TOOL_SLUGS.map(tool=>pages.filter(p=>p.tool===tool).length),[8,5,4]);
  for (const p of pages) {
    assert.ok(CONVERSION_TOOL_SLUGS.includes(p.tool));
    assert.ok(/^[a-z0-9-]+$/.test(p.slug));
    assert.ok(p.checks.length>=2 && p.facts.length>=4 && p.answer.length>60);
    assert.ok(p.samples.every(f=>fs.existsSync('public/template-samples/'+f)), p.slug);
    assert.ok(fs.existsSync(`public/template-samples/previews/${p.tool}-${p.slug}.png`), 'actual output preview: '+p.slug);
    assert.equal(Boolean(p.preset),p.tool==='jpg-to-pdf','only real image options exposed');
    if(p.preset) {
      assert.ok(['a4','letter','fit'].includes(p.preset.pageSize));
      assert.ok(['auto','portrait','landscape'].includes(p.preset.orientation));
      assert.ok(['none','small','big'].includes(p.preset.margin));
      assert.equal(typeof p.preset.merge,'boolean');
    }
    assert.ok(!JSON.stringify(p).includes('/Users/'), 'no private file paths');
    assert.ok(!JSON.stringify(p).includes('Zagros'), 'no customer evidence published');
  }
  // Guard against keyword-swapped clones: each pair must have different workflow instructions.
  for (const p of pages) for (const q of pages) if (p!==q) {
    assert.notEqual(p.description, q.description);
    assert.notDeepEqual(p.checks, q.checks);
  }
});

test('review spreadsheet mirrors the catalog without publishing or using customer files',()=>{
  const columns=['tool','slug','title','description','input','output','preset','samples','facts','checks','question','answer','tags','legacy'];
  const cell=value=>'"'+(typeof value==='object'?JSON.stringify(value):String(value??'')).replaceAll('"','""')+'"';
  const expected=[columns.map(cell).join(','),...pages.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n')+'\r\n';
  assert.equal(fs.readFileSync('docs/conversion-template-catalog.csv','utf8'),expected);
  const generator=fs.readFileSync('scripts/create-template-samples.cjs','utf8');
  assert.ok(!generator.includes('/Downloads/') && !generator.includes('fetch('));
});

test('all twelve locales expose truthful scoped capabilities and UI copy', () => {
  for (const l of getActiveLocales()) {
    assert.equal(CONVERSION_COPY[l.code].length,12,l.code);
    if(l.code!=='en') assert.equal(CONVERSION_UI_ROWS[l.code].split('|').length,CONVERSION_UI_KEYS.length,l.code);
    for(const slug of CONVERSION_TOOL_SLUGS) {
      const copy=conversionCopy(l.code,slug);
      assert.ok(copy.description.length>20 && copy.limitations.length>20);
      assert.equal(copy.steps.length,3);
      if(l.code!=='en') assert.notEqual(copy.limitations,conversionCopy('en',slug).limitations);
    }
  }
});

test('English tool canonicals have reciprocal language maps and shared implementation', () => {
  for(const slug of CONVERSION_TOOL_SLUGS) {
    const source=fs.readFileSync(`src/app/${slug}/tool-page.tsx`,'utf8');
    assert.ok(source.includes(`getHreflangLanguagesMap("/${slug}")`));
    assert.ok(source.includes(`<ConversionDetails tool="${slug}" locale={locale}`));
  }
  const sitemap=fs.readFileSync('src/app/sitemap.ts','utf8');
  assert.ok(sitemap.includes('CONVERSION_TEMPLATES.map'));
  assert.ok(!sitemap.includes('"/workflows"'));
  assert.ok(sitemap.includes('TOOLS.some(tool => tool.path === path)'));
  assert.ok(fs.readFileSync('src/app/workflows/[slug]/page.tsx','utf8').includes('dynamicParams = false'));
});

test('template pages mount existing converters and legacy pages only redirect',()=>{
  const runner=fs.readFileSync('src/components/templates/ConversionTemplateRunner.tsx','utf8');
  for(const tool of CONVERSION_TOOL_SLUGS) assert.ok(runner.includes(`@/app/${tool}/`));
  const detail=fs.readFileSync('src/app/templates/conversions/[tool]/[template]/page.tsx','utf8');
  assert.ok(detail.includes('<ConversionTemplateRunner template={row}'));
  assert.ok(detail.includes('dynamicParams = false'));
  const legacy=fs.readFileSync('src/app/workflows/[slug]/page.tsx','utf8');
  assert.ok(legacy.includes('permanentRedirect(destination)'));
  assert.equal(pages.filter(p=>p.legacy).length+2,12,'all 12 legacy details mapped');
  assert.ok(!legacy.includes('TechArticle'));
});
