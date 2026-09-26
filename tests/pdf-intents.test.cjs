const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./load-ts.cjs');
const { PDF_INTENTS, PUBLISHED_PDF_INTENTS, validatePdfIntents } = loadTs('src/lib/content/pdf-intents.ts');
const { planPdfSize } = loadTs('src/lib/pdf-size-planner.ts');

test('upload planner compares mixed units in bytes', () => {
  assert.deepEqual(planPdfSize('12', '10', '5', 'MB', 'MB'), { target: 9.5, reduction: 20.833333333333336, unit: 'MB' });
  const result = planPdfSize('1', '1000', '0', 'MiB', 'KB');
  assert.ok(Math.abs(result.reduction - 4.632568359375) < 1e-10);
  assert.equal(result.target, 1000);
  assert.equal(planPdfSize('900', '1', '0', 'KB', 'MB').reduction, 0);
});

test('invalid and overflowing planner inputs do not show a misleading target', () => {
  for (const values of [['', '10', '5'], ['0', '10', '5'], ['-1', '10', '5'], ['12', '0', '5'], ['12', '10', '100'], ['12', '10', '-1'], ['NaN', '10', '5'], ['Infinity', '10', '5'], ['1e308', '10', '5']]) {
    assert.equal(planPdfSize(...values, 'MB', 'MB'), null);
  }
});

test('all six reference intents have reachable distinct canonical routes', () => {
  assert.equal(PUBLISHED_PDF_INTENTS.length, 6);
  assert.deepEqual(PDF_INTENTS.reduce((counts, page) => ({...counts, [page.family]: (counts[page.family] || 0) + 1}), {}), {tool: 2, task: 2, guide: 2});
  assert.doesNotThrow(() => validatePdfIntents(PDF_INTENTS));
});

test('catalog gate blocks broken links, duplicate paths and published links to drafts', () => {
  assert.throws(() => validatePdfIntents([...PDF_INTENTS, PDF_INTENTS[0]]), /Duplicate/);
  assert.throws(() => validatePdfIntents(PDF_INTENTS.map((page, i) => i ? page : {...page, related: ['missing']})), /Incomplete|Invalid related/);
  assert.throws(() => validatePdfIntents(PDF_INTENTS.map((page, i) => i ? page : {...page, status: 'draft'})), /Invalid related/);
});
