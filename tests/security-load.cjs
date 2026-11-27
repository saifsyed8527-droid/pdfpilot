const fs = require('node:fs');
const ts = require('typescript');
exports.load = (file, mocks = {}, globals = {}) => {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', ...Object.keys(globals), source)(
    name => name === 'server-only' ? {} : name in mocks ? mocks[name] : require(name),
    mod, mod.exports, ...Object.values(globals),
  );
  return mod.exports;
};
