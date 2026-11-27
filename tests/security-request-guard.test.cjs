const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./security-load.cjs');
const fresh = () => load('src/lib/server/request-guard.ts');
const req = (body, headers = {}) => new Request('https://pdfpilot.net/api/import', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body,
});
test('JSON guard enforces object schema, field allowlist, MIME, origin and byte limits', async () => {
  const { readLimitedJson: read } = fresh();
  for (const input of ['null','[]','1','"url"','{"__proto__":{}}','{"role":"admin"}','{']) {
    assert.equal((await read(req(input), 128, ['url'])).status, 400, input);
  }
  assert.equal((await read(req('{"url":"ok"}'),128,['url'])).ok,true);
  assert.equal((await read(req('{}',{'origin':'https://evil.test'}),128)).status,403);
  assert.equal((await read(req('{}',{'origin':'null'}),128)).status,403);
  assert.equal((await read(req('{}',{'sec-fetch-site':'cross-site'}),128)).status,403);
  assert.equal((await read(req('{}',{'content-type':'text/plain'}),128)).status,415);
  assert.equal((await read(req('{}',{'content-type':'application/jsonp'}),128)).status,415);
  assert.equal((await read(req('x'.repeat(129)),128)).status,413);
  for (const size of ['-1','NaN','1e2','1.5','999999999999999999999'])
    assert.equal((await read(req('{}',{'content-length':size}),128)).status,413);
});
test('stalled request body is cancelled at deadline', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  let cancelled = false;
  const request = new Request('https://pdfpilot.net/api/import', {method:'POST',headers:{'content-type':'application/json'},body:new ReadableStream({cancel(){cancelled=true;}}),duplex:'half'});
  const pending = fresh().readLimitedJson(request,128);
  t.mock.timers.tick(5001);
  assert.equal((await pending).status,408);
  assert.equal(cancelled,true);
});
test('caller-controlled forwarding headers cannot reset rate counters off Vercel', () => {
  const old=process.env.VERCEL;delete process.env.VERCEL;
  try {
    const {checkRateLimit: check}=fresh();
    assert.equal(check(req('{}',{'x-real-ip':'8.8.8.8'}),'imports',1).allowed,true);
    assert.equal(check(req('{}',{'x-real-ip':'9.9.9.9','x-forwarded-for':'1.1.1.1'}),'imports',1).allowed,false);
  } finally {if(old!==undefined)process.env.VERCEL=old;}
});
test('Vercel uses only the trusted IP and counter storage fails closed when full', () => {
  const old=process.env.VERCEL;process.env.VERCEL='1';
  try {
    const {checkRateLimit: check}=fresh();
    for(let i=0;i<10000;i++)assert.equal(check(req('{}',{'x-vercel-forwarded-for':`8.${Math.floor(i/65536)}.${Math.floor(i/256)%256}.${i%256}`}),'imports',1).allowed,true);
    assert.equal(check(req('{}',{'x-vercel-forwarded-for':'9.9.9.9'}),'imports',1).allowed,false);
  } finally {if(old===undefined)delete process.env.VERCEL;else process.env.VERCEL=old;}
});
test('Cloudflare egress uses a bounded aggregate budget, never a supplied visitor header', () => {
  const old=process.env.VERCEL;process.env.VERCEL='1';
  try {
    const {checkRateLimit: check}=fresh();
    for(let i=0;i<1200;i++)assert.equal(check(req('{}',{'x-vercel-forwarded-for':'172.64.1.1','cf-connecting-ip':`8.8.8.${i%250}`}),'imports',10).allowed,true);
    assert.equal(check(req('{}',{'x-vercel-forwarded-for':'172.64.1.1','cf-connecting-ip':'9.9.9.9'}),'imports',10).allowed,false);
    assert.equal(check(req('{}',{'x-vercel-forwarded-for':'8.8.8.8','cf-connecting-ip':'172.64.1.1'}),'direct',1).allowed,true);
    assert.equal(check(req('{}',{'x-vercel-forwarded-for':'8.8.8.8','cf-connecting-ip':'172.64.1.2'}),'direct',1).allowed,false);
  } finally {if(old===undefined)delete process.env.VERCEL;else process.env.VERCEL=old;}
});
