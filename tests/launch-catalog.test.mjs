import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAUNCH_TOOL_SLUGS, isLaunchTool, selectLaunchTools, LOCALIZED_LAUNCH_TOOL_SLUGS } from '../src/lib/launch-catalog.ts';

const all = JSON.parse(readFileSync(new URL('../src/lib/tools-data.json', import.meta.url), 'utf8'));
const original = ['pdf-to-jpg','jpg-to-pdf','word-to-pdf','powerpoint-to-pdf','excel-to-pdf','html-to-pdf','pdf-to-word','pdf-to-powerpoint','pdf-to-excel','pdf-to-pdfa','delete-pages','merge-pdf','compress-pdf','split-pdf','extract-pages','organize-pdf','scan-pdf','repair-pdf','ocr-pdf','rotate-pdf','add-page-numbers','watermark-pdf','crop-pdf','edit-pdf','fill-pdf','excel-to-xml'];
const priority = [...original, "flatten-pdf", "base64-encode", "base64-decode", "url-encode", "url-decode", "json-formatter", "json-minifier", "json-validator"];
const expected = [...new Set([...priority, ...[...all].sort((a,b) => a.order-b.order).map(tool => tool.slug)])];

test('exact owner launch scope and order, with no duplicate entries', () => {
  assert.deepEqual(LAUNCH_TOOL_SLUGS, expected);
  const selected = selectLaunchTools([...all].reverse());
  assert.deepEqual(selected.map(tool => tool.slug), expected);
  assert.equal(new Set(selected.map(tool => tool.path)).size, expected.length);
  assert.deepEqual(selected.map(tool => tool.order), expected.map((_, i) => i + 1));
  for (const slug of expected) assert.ok(readFileSync(new URL(`../src/app/${slug}/page.tsx`, import.meta.url), 'utf8'));
});
test('all original and newly added tools are public while unknown tools remain unavailable', () => {
  assert.equal(all.length, 109);
  assert.ok(isLaunchTool("redact-pdf"));
  assert.ok(isLaunchTool("pdf-to-markdown"));
  assert.ok(isLaunchTool("sign-pdf"));
  assert.ok(isLaunchTool("photo-editor"));
  assert.ok(isLaunchTool("meme-generator"));
  assert.ok(isLaunchTool("blur-face"));
  assert.ok(isLaunchTool("html-to-image"));
  assert.ok(isLaunchTool("remove-background"));
  assert.ok(isLaunchTool("upscale-image"));
  assert.ok(isLaunchTool("translate-pdf"));
  assert.equal(LAUNCH_TOOL_SLUGS.length, 109);
  assert.deepEqual([...LAUNCH_TOOL_SLUGS].sort(), all.map(tool => tool.slug).sort());
  assert.equal(isLaunchTool("not-a-tool"), false);
  for (const slug of ['xml-to-excel', 'unlock-pdf', 'summary-generator', 'convert-image']) {
    assert.ok(all.find(tool => tool.slug === slug));
    assert.equal(isLaunchTool(slug), true);
  }
  assert.throws(() => selectLaunchTools([]), /missing/);
});

test('the established dictionary order stays stable', () => {
  assert.deepEqual(LOCALIZED_LAUNCH_TOOL_SLUGS, original);
});
