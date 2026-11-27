const test = require('node:test');
const assert = require('node:assert/strict');
const {load} = require('./security-load.cjs');
const request = () => new Request('https://pdfpilot.net/api/import', {headers:{'x-vercel-forwarded-for':'8.8.8.8'}});
function check(fetch, env = {}) {
  return load('src/lib/server/request-guard.ts', {}, {fetch, process:{env:{VERCEL:'1', VERCEL_ENV:'production', SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_SECRET_KEY:'test-server-key', ...env}}}).checkApiRateLimit;
}
test('separate application instances use the same private shared counter', async () => {
  const calls=[];
  const backend=async(url, options)=>{
    calls.push({url:String(url),...options});
    return Response.json({allowed:calls.length<=1,retry_after:calls.length<=1?0:60});
  };
  assert.equal((await check(backend)(request(),'html',1)).allowed,true);
  assert.deepEqual(await check(backend)(request(),'html',1),{allowed:false,retryAfter:60});
  assert.equal(calls[0].body,calls[1].body);
  assert.match(JSON.parse(calls[0].body).bucket_key,/^[a-f0-9]{64}$/);
  assert.ok(!calls[0].body.includes('8.8.8.8'));
  assert.equal(calls[0].headers.apikey,'test-server-key');
  assert.equal(calls[0].headers.Authorization,undefined);
  assert.equal(calls[0].cache,'no-store');
});
test('backend errors, malformed responses and missing production config fail closed', async () => {
  for(const backend of [async()=>{throw Error('secret');},async()=>new Response('',{status:500}),async()=>Response.json({allowed:true,retry_after:'bad'})]) {
    assert.deepEqual(await check(backend)(request(),'html',10),{allowed:false,retryAfter:5,unavailable:true});
  }
  const noFetch=()=>{throw Error('must not fetch');};
  assert.equal((await check(noFetch,{SUPABASE_SECRET_KEY:''})(request(),'html',10)).unavailable,true);
  assert.equal((await check(noFetch,{SUPABASE_URL:'https://attacker.test'})(request(),'html',10)).unavailable,true);
  assert.equal((await check(noFetch,{SUPABASE_SECRET_KEY:'',VERCEL_ENV:'preview'})(request(),'html',10)).allowed,true);
});
test('legacy service key auth and proxy aggregate budget remain explicit',async()=>{
  let options;
  const run=check(async(_,o)=>{options=o;return Response.json({allowed:true,retry_after:0});},{SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'eyJ.test'});
  await run(new Request('https://pdfpilot.net',{headers:{'x-vercel-forwarded-for':'172.64.1.1','cf-connecting-ip':'9.9.9.9'}}),'html',10);
  assert.equal(options.headers.Authorization,'Bearer eyJ.test');
  assert.equal(JSON.parse(options.body).request_limit,1200);
  assert.ok(!options.body.includes('9.9.9.9'));
  assert.ok(options.signal instanceof AbortSignal);
});
