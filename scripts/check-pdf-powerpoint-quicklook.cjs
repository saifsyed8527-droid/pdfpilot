// macOS viewer regression: compare each Quick Look page image with its PPTX part.
// Usage: node scripts/check-pdf-powerpoint-quicklook.cjs output.pptx [...]
// Input files stay local; the temporary Quick Look previews are removed afterward.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {unzipSync, strFromU8} = require('fflate');

if (process.platform !== 'darwin' || !process.argv[2]) {
  console.error('Run on macOS with one or more generated appearance-mode PPTX files.');
  process.exit(1);
}
for (const input of process.argv.slice(2)) {
  const file = path.resolve(input);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfpilot-quicklook-'));
  try {
    const zip = unzipSync(fs.readFileSync(file));
    const slides = Object.keys(zip).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a,b) => Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
    assert.ok(slides.length, 'No slides');
    execFileSync('qlmanage', ['-p', '-o', temp, file], {stdio: 'pipe', timeout: 120000});
    const preview = path.join(temp, path.basename(file)+'.qlpreview');
    const html = fs.readFileSync(path.join(preview, 'Preview.html'), 'utf8');
    const images = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]);
    assert.equal(images.length, slides.length, 'Quick Look must display one picture per source page');
    for (const [index, entry] of slides.entries()) {
      const ownSlide = strFromU8(zip[entry]);
      assert.doesNotMatch(ownSlide, /<p:(sp|pic|grpSp|graphicFrame)>|<a:t>/, `${entry}: direct objects can corrupt Quick Look previews`);
      const slideRelations = strFromU8(zip[entry.replace('slides/', 'slides/_rels/')+'.rels']);
      const layoutTarget = slideRelations.match(/Type="[^"]+\/slideLayout" Target="([^"]+)"/)[1];
      const layout = path.posix.normalize('ppt/slides/'+layoutTarget);
      const slide = strFromU8(zip[layout]);
      assert.equal((slide.match(/<p:pic>/g)||[]).length, 1, entry);
      assert.doesNotMatch(slide, /<p:(sp|grpSp|graphicFrame)>|<a:t>/, `${entry}: additional objects can corrupt Quick Look previews`);
      const embed = slide.match(/<a:blip r:embed="([^"]+)"/)[1];
      const relations = strFromU8(zip[path.posix.dirname(layout)+'/_rels/'+path.posix.basename(layout)+'.rels']);
      const relation = [...relations.matchAll(/<Relationship\b[^>]+>/g)].find(m => m[0].includes(`Id="${embed}"`));
      assert.ok(relation, `Missing image relationship on page ${index+1}`);
      const target = relation[0].match(/Target="([^"]+)"/)[1];
      const source = zip[path.posix.normalize('ppt/slides/'+target)];
      assert.ok(source, `Missing page image ${index+1}`);
      const renderedPath = path.resolve(preview, images[index]);
      assert.ok(renderedPath.startsWith(preview+path.sep), 'Unexpected external preview image');
      assert.ok(Buffer.from(source).equals(fs.readFileSync(renderedPath)), `Page ${index+1} repeats another image or changes the source picture`);
      assert.ok(zip[`ppt/notesSlides/notesSlide${index+1}.xml`], 'Extracted text notes missing');
    }
    console.log(JSON.stringify({file, pages: slides.length, matchedImages: images.length, passed: true}));
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
  }
}
