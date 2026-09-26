const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(source) {
  const filename = path.resolve(source);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + (path.extname(name) ? '' : '.ts'))) : require(name);
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
module.exports = { load };
