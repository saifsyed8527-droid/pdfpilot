const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();
function loadTs(file){
 let f=path.resolve(file);if(!fs.existsSync(f)&&f.endsWith('.ts'))f+='x';
 if(cache.has(f))return cache.get(f).exports;
 if(f.endsWith('.json'))return JSON.parse(fs.readFileSync(f,'utf8'));
 const m={exports:{}};cache.set(f,m);
 let source=fs.readFileSync(f,'utf8');
 if(f.includes('/lib/i18n/')){
  const vars=[...source.matchAll(/^(?:export )?const (\w+)(?:\s*:|\s*=)/gm)].map(x=>x[1]);
  source+='\nexport const __tables={'+vars.join(',')+'};';
 }
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 function req(n){if(n==='lucide-react')return new Proxy({},{get:()=>()=>null});if(n.startsWith('@/'))return loadTs(path.resolve('src',n.slice(2)+(path.extname(n)?'':'.ts')));if(n.startsWith('.'))return loadTs(path.resolve(path.dirname(f),n+(path.extname(n)?'':'.ts')));return require(n);}
 new Function('require','module','exports',code)(req,m,m.exports);return m.exports;
}
module.exports={loadTs};
