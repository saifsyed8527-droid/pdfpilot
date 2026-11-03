const test = require('node:test'), assert = require('node:assert/strict');
const { load } = require('../scripts/load-pseo-modules.cjs');
const { htmlSourceBase, htmlSourceLink } = load('src/lib/engines/html-source-links.ts');

test('website links resolve against the fetched page and declared HTML base, never the hosting app', () => {
  const source = 'https://example.org/docs/guide.html';
  assert.equal(htmlSourceBase(source), source);
  const base = htmlSourceBase(source, '../manual/');
  assert.equal(base, 'https://example.org/manual/');
  assert.equal(htmlSourceLink('chapter.html#part-2', base), 'https://example.org/manual/chapter.html#part-2');
  assert.equal(htmlSourceLink('/privacy', base), 'https://example.org/privacy');
  assert.equal(htmlSourceLink('#summary', source), source + '#summary');
  assert.equal(htmlSourceLink('//other.example.org/help', base), 'https://other.example.org/help');
  assert.equal(htmlSourceBase(source, 'https://cdn.example.org/docs/'), 'https://cdn.example.org/docs/');
});

test('unsafe or unresolved local links cannot become unrelated PDF Pilot links', () => {
  const source = 'https://example.org/docs/';
  for (const invalid of ['javascript:alert(1)', 'data:text/html,hello', 'file:///secret', 'https://name:password@example.org/', 'not a URL']) {
    assert.equal(htmlSourceBase(undefined, invalid), undefined);
  }
  assert.equal(htmlSourceBase(source, 'javascript:alert(1)'), source);
  assert.equal(htmlSourceBase(undefined, 'https://example.org/local/'), 'https://example.org/local/');
  for (const invalid of ['', '  ', '#part', '/about', '../next.html', 'javascript:alert(1)', 'data:text/html,hello', 'https://name:password@example.org/']) assert.equal(htmlSourceLink(invalid), undefined);
  assert.equal(htmlSourceLink('mailto:help@example.org'), 'mailto:help@example.org');
  assert.equal(htmlSourceLink('tel:+123456789'), 'tel:+123456789');
  assert.equal(htmlSourceLink('https://example.org/हिन्दी'), 'https://example.org/%E0%A4%B9%E0%A4%BF%E0%A4%A8%E0%A5%8D%E0%A4%A6%E0%A5%80');
});
