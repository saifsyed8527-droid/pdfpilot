const test = require('node:test'),assert = require('node:assert/strict'),fs = require('node:fs'),ts = require('typescript');
function mockRoute(route, contentType, body, finalUrl) {
 const mod = { exports: {} };
 const code = ts.transpileModule(fs.readFileSync(`src/app/api/html-to-pdf/${route}/route.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const modules = {
  'next/server': {NextResponse: class extends Response {static json(body,opts){return Response.json(body,opts);}}},
  '@/lib/server/safe-public-fetch': {safePublicFetch:async()=>({bytes:new TextEncoder().encode(body),contentType,finalUrl})},
  '@/lib/server/request-guard': {checkApiRateLimit:async()=>({allowed:true}),readLimitedJson:async r=>({ok:true,value:await r.json()})},
 };
 new Function('require','module','exports',code)(id=>modules[id],mod,mod.exports);
 return mod.exports;
}
test('proxied ordinary stylesheet keeps body and sandbox yet opts out of caching',async()=>{
 const route=mockRoute('asset','text/css','body { color: #333; }','https://example.test/design.css');
 const res=await route.GET(new Request('https://pdfpilot.test/api/html-to-pdf/asset?url=https%3A%2F%2Fexample.test%2Fdesign.css'));
 assert.equal(res.status,200);
 assert.equal(res.headers.get('cache-control'),'private, no-store');
 assert.equal(res.headers.get('content-type'),'text/css');
 assert.equal(res.headers.get('x-content-type-options'),'nosniff');
 assert.match(res.headers.get('content-security-policy'),/^sandbox;/);
 assert.equal(await res.text(),'body { color: #333; }');
});
test('proxied ordinary HTML preserves the response contract without caching',async()=>{
 const url='https://example.test/doc.html',html='<main>Example PDF input</main>';
 const route=mockRoute('fetch','text/html',html,url);
 const res=await route.POST(new Request('https://pdfpilot.test/api/html-to-pdf/fetch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})}));
 assert.equal(res.status,200);
 assert.equal(res.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(await res.json(),{html,finalUrl:url});
});
