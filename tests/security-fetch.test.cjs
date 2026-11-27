const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {load}=require('./security-load.cjs');
function harness({dns=[{address:'93.184.216.34',family:4}],reply,lookupError}={}) {
  const calls=[];
  const transport={request(url,options,callback){
    const request=new EventEmitter();request.setTimeout=()=>request;
    request.destroy=error=>{if(error)request.emit('error',error);};
    const abort=()=>request.destroy(new Error('aborted'));
    options.signal.addEventListener('abort',abort,{once:true});
    request.end=()=>queueMicrotask(()=>{
      const response=new EventEmitter();response.statusCode=200;response.headers={'content-type':'text/plain'};
      response.destroy=error=>{response.destroyed=true;options.signal.removeEventListener('abort',abort);if(error)response.emit('error',error);response.emit('aborted');};
      calls.push({url:url.href,options,response});
      if(reply)reply({url,options,callback,response,calls});
      else{callback(response);response.emit('data',Buffer.from('ok'));response.emit('end');options.signal.removeEventListener('abort',abort);}
    });return request;
  }};
  const api=load('src/lib/server/safe-public-fetch.ts',{'node:dns/promises':{lookup:async()=>{if(lookupError)throw lookupError;return dns;}},'node:http':transport,'node:https':transport});
  return {...api,calls};
}
test('private, mapped, metadata and transition addresses are denied before any connection',async()=>{
  const h=harness();
  for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','192.168.1.1','::1','::ffff:127.0.0.1','::ffff:7f00:1','64:ff9b::a00:1','2002:7f00:1::','2001:db8::1','fe80::1','fc00::1']) {
    assert.equal(h.isPrivateAddress(ip),true,ip);
    await assert.rejects(h.safePublicFetch(`http://${ip.includes(':')?'['+ip+']':ip}/`,1024));
  }
  assert.equal(h.calls.length,0);
  for(const ip of ['8.8.8.8','93.184.216.34','2606:4700:4700::1111'])assert.equal(h.isPrivateAddress(ip),false,ip);
});
test('all DNS answers checked, DNS resolution pinned into request, credentials never forwarded',async()=>{
  const mixed=harness({dns:[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}]});
  await assert.rejects(mixed.safePublicFetch('https://public.test/',100),/not available/);assert.equal(mixed.calls.length,0);
  const h=harness();assert.equal(new TextDecoder().decode((await h.safePublicFetch('https://public.test/',100)).bytes),'ok');
  h.calls[0].options.lookup('public.test',{},(error,address)=>assert.equal(address,'93.184.216.34'));
  assert.equal(h.calls[0].options.headers.Authorization,undefined);
  for(const url of ['file:///etc/passwd','http://user:pass@public.test/','https://public.test:8443/'])await assert.rejects(h.safePublicFetch(url,100));
});
test('redirect bodies destroyed and redirected destinations revalidated',async()=>{
  const h=harness({reply({callback,response}){response.statusCode=302;response.headers.location='http://127.0.0.1/';callback(response);}});
  await assert.rejects(h.safePublicFetch('https://public.test/',100),/Private/);
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].response.destroyed,true);
});
test('byte budgets, incomplete responses and raw infrastructure errors fail safely',async()=>{
  const h=harness({reply({callback,response}){callback(response);response.emit('data',Buffer.alloc(101));}});
  await assert.rejects(h.safePublicFetch('https://public.test/',100),/too large/);
  const broken=harness({lookupError:new Error('ENOTFOUND secret-internal-host')});
  await assert.rejects(broken.safePublicFetch('https://public.test/',100),error=>!error.message.includes('secret-internal-host')&&/Could not import/.test(error.message));
  const incomplete=harness({reply({callback,response}){callback(response);response.emit('aborted');}});
  await assert.rejects(incomplete.safePublicFetch('https://public.test/',100),/incomplete/);
});
test('one total deadline covers DNS, active requests and drip-fed bodies',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=harness({reply({callback,response}){callback(response);response.emit('data',Buffer.from('x'));}});
  const pending=h.safePublicFetch('https://public.test/',100);
  await new Promise(resolve=>setImmediate(resolve));
  t.mock.timers.tick(25001);
  await assert.rejects(pending,/took too long/);
});
test('abort and bounded concurrency release slots for later imports',async()=>{
  const h=harness({reply({callback,response}){callback(response);}}),controller=new AbortController();
  const pending=Array.from({length:8},()=>h.safePublicFetch('https://public.test/',100,controller.signal));
  const settled=Promise.allSettled(pending);
  await assert.rejects(h.safePublicFetch('https://public.test/',100),/busy/);
  controller.abort();assert.ok((await settled).every(x=>x.status==='rejected'));
});
test('public redirects succeed with a fresh pinned connection and bounded redirect count',async()=>{
 const h=harness({reply({callback,response,calls}){if(calls.length===1){response.statusCode=302;response.headers.location='/final';callback(response);}else{callback(response);response.emit('data',Buffer.from('final'));response.emit('end');}}});
 const response=await h.safePublicFetch('https://public.test/start',100);
 assert.equal(response.finalUrl,'https://public.test/final');assert.equal(h.calls.length,2);
 const loop=harness({reply({callback,response}){response.statusCode=302;response.headers.location='/again';callback(response);}});
 await assert.rejects(loop.safePublicFetch('https://public.test/',100),/Too many redirects/);assert.equal(loop.calls.length,5);
});
test('DNS stall cannot outlive total deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const h=load('src/lib/server/safe-public-fetch.ts',{'node:dns/promises':{lookup:()=>new Promise(()=>{})}});
 const pending=h.safePublicFetch('https://public.test/',100);t.mock.timers.tick(25001);
 await assert.rejects(pending,/took too long/);
});
test('oversized declared body and compressed responses are rejected before buffering',async()=>{
 for(const headers of [{'content-length':'101'},{'content-encoding':'gzip'}]){
  const h=harness({reply({callback,response}){Object.assign(response.headers,headers);callback(response);}});
  await assert.rejects(h.safePublicFetch('https://public.test/',100));assert.equal(h.calls[0].response.destroyed,true);
 }
});
