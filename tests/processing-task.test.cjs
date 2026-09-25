const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

test('cancel then restart does not revive the old task or clear the new progress', async () => {
  const state = [], calls = [];
  const react = {
    useState(initial) { const i=state.length; state.push(initial); return [initial,v=>{state[i]=v}]; },
    useRef: initial=>({current:initial}), useCallback: fn=>fn,
  };
  const source=ts.transpileModule(fs.readFileSync('src/lib/use-processing-task.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  const requireStub=name=>{
    if(name==='react')return react;
    if(name==='react/jsx-runtime')return {jsx:()=>null};
    if(name==='lucide-react')return {};
    if(name==='sonner')return {toast:{success:()=>calls.push('success'),error:()=>calls.push('error')}};
    if(name==='@/lib/analytics/events')return {trackToolConversionCompleted:()=>{},trackToolConversionFailed:()=>{}};
    throw Error(name);
  };
  new Function('require','module','exports',source)(requireStub,module,module.exports);
  const hook=module.exports.useProcessingTask();
  let resolveOld,resolveNew,oldCancelled;
  const oldGate=new Promise(resolve=>{resolveOld=resolve}),newGate=new Promise(resolve=>{resolveNew=resolve});
  const options={toolName:'powerpoint-to-pdf',successMessage:'Ready',errorTitle:'Error'};
  const oldRun=hook.run(async (setProgress,cancelled)=>{await oldGate;oldCancelled=cancelled();setProgress(80);},options);
  hook.cancel();
  const newRun=hook.run(async setProgress=>{setProgress(12);await newGate;setProgress(100);},options);
  resolveOld();await oldRun;
  assert.equal(oldCancelled,true);assert.equal(state[0],true);assert.equal(state[1],12);assert.deepEqual(calls,[]);
  resolveNew();await newRun;
  assert.equal(state[0],false);assert.equal(state[1],100);assert.deepEqual(calls,['success']);
});
