const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
function handler(reply) {
  const cache=new Map(),requests=[];
  function load(filename) {
    if(cache.has(filename))return cache.get(filename).exports;
    const module={exports:{}};cache.set(filename,module);
    const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    function localRequire(name) {
      if(name==='server-only')return {};
      if(name==='@/lib/server/safe-public-fetch')return {safePublicFetch:async(url,limit)=>{requests.push({url,limit});return reply;}};
      if(name.startsWith('@/'))return load(path.resolve('src',name.slice(2)+'.ts'));
      return require(name);
    }
    new Function('require','module','exports',code)(localRequire,module,module.exports);
    return module.exports;
  }
  return {post:load(path.resolve('src/app/api/cloud-import/route.ts')).POST,requests};
}
const publicLink='https://www.dropbox.com/s/test/document.pdf?dl=0';
const request=(value)=>new Request('https://pdfpilot.net/api/cloud-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});

test('cloud import preserves PDF bytes and safe Unicode download name without caching',async()=>{
  const bytes=new TextEncoder().encode('%PDF-1.7\nverified fixture'),{post,requests}=handler({bytes,contentType:'application/pdf',contentDisposition:"attachment; filename*=UTF-8''%D1%84%D0%B0%D0%B9%D0%BB.pdf"});
  const response=await post(request({url:publicLink,provider:'dropbox'}));
  assert.equal(response.status,200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('x-robots-tag'),'noindex');
  assert.equal(decodeURIComponent(response.headers.get('content-disposition').split("''")[1]),'файл.pdf');
  assert.equal(requests[0].limit,4*1024*1024);
});

test('sign-in pages are rejected but an explicitly attached HTML source is accepted',async()=>{
  const reply={bytes:new TextEncoder().encode('<!doctype html><html><title>Sign in</title></html>'),contentType:'text/html'};
  const rejected=await handler(reply).post(request({url:publicLink,provider:'dropbox'}));
  assert.equal(rejected.status,400);assert.match((await rejected.json()).error,/sign-in/);
  const attached=await handler({...reply,contentDisposition:'attachment; filename="source.html"'}).post(request({url:publicLink,provider:'dropbox'}));
  assert.equal(attached.status,200);
});

test('invalid links, oversized requests, empty files and malformed bodies cannot return successful imports',async()=>{
  const {post,requests}=handler({bytes:new Uint8Array(),contentType:'application/pdf'});
  for(const body of [null,{}, {url:'https://drive.google.com.evil.test/file/d/test/view',provider:'google-drive'}, {url:publicLink,provider:'unknown'}]) assert.equal((await post(request(body))).status,400);
  assert.equal(requests.length,0);
  assert.equal((await post(request({url:'x'.repeat(5000),provider:'dropbox'}))).status,413);
  const empty=await post(request({url:publicLink,provider:'dropbox'}));
  assert.equal(empty.status,400);assert.match((await empty.json()).error,/empty/);
});
