const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Isolated loader for pure, relative-import TypeScript dictionaries in Node tests.
exports.loadTs = function loadTs(filename, cache = new Map()) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localRequire = (name) => {
    if (!name.startsWith(".")) throw new Error(`Unexpected dependency: ${name}`);
    return loadTs(path.resolve(path.dirname(filename), `${name}.ts`), cache);
  };
  new Function("require", "module", "exports", source)(localRequire, module, module.exports);
  return module.exports;
};
