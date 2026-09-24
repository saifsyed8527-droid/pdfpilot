import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAUNCH_TOOL_SLUGS, isLaunchTool, selectLaunchTools } from '../src/lib/launch-catalog.ts';

const all = JSON.parse(readFileSync(new URL('../src/lib/tools-data.json', import.meta.url), 'utf8'));
const expected = ['pdf-to-jpg','jpg-to-pdf','word-to-pdf','powerpoint-to-pdf','excel-to-pdf','html-to-pdf','pdf-to-word','pdf-to-powerpoint','pdf-to-excel','pdf-to-pdfa','delete-pages','merge-pdf','compress-pdf','split-pdf','extract-pages','organize-pdf','scan-pdf','repair-pdf','ocr-pdf','rotate-pdf','add-page-numbers','watermark-pdf','crop-pdf','edit-pdf','fill-pdf','excel-to-xml'];
test('exact owner launch scope and order, with no duplicate entries', () => {
  assert.deepEqual(LAUNCH_TOOL_SLUGS, expected);
  const selected = selectLaunchTools([...all].reverse());
  assert.deepEqual(selected.map(tool => tool.slug), expected);
  assert.equal(new Set(selected.map(tool => tool.path)).size, 26);
  assert.deepEqual(selected.map(tool => tool.order), expected.map((_, i) => i + 1));
  for (const slug of expected) assert.ok(readFileSync(new URL(`../src/app/${slug}/page.tsx`, import.meta.url), 'utf8'));
});
test('unlisted tools remain in source but are not public launch tools', () => {
  assert.ok(all.length > 26);
  for (const slug of ['flatten-pdf', 'xml-to-excel', 'unlock-pdf', 'summary-generator', 'convert-image']) {
    assert.ok(all.find(tool => tool.slug === slug));
    assert.equal(isLaunchTool(slug), false);
  }
  assert.throws(() => selectLaunchTools([]), /missing/);
});
