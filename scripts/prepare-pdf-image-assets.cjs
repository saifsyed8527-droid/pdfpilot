// Keep fonts, CMaps and image decoders on the same origin and exact PDF.js version.
const fs = require('node:fs');
const path = require('node:path');
const root = path.dirname(require.resolve('pdfjs-dist/package.json'));
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
  const target = path.resolve('public/pdfjs-assets', directory);
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(path.join(root, directory), target, { recursive: true });
}
console.log('PDF image fonts and decoders prepared locally.');
