const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:4405';
const prefix = process.env.PDFPILOT_CODEC_ROUTE_PREFIX || '';
const out = process.env.PDFPILOT_CODEC_OUTPUT || path.resolve('reports/encoding-browser');
const sample = '  नमस्ते · مرحبا · café · 日本語 · 🧑🏽‍🚀\n\t/?a=1&b=+ #100%  ';
const configs = [
  {slug:'base64-encode', action:'Encode to Base64', input:sample, output:Buffer.from(sample).toString('base64')},
  {slug:'base64-decode', action:'Decode Base64', input:Buffer.from(sample).toString('base64'), output:sample},
  {slug:'url-encode', action:'URL Encode', input:sample, output:encodeURIComponent(sample)},
  {slug:'url-decode', action:'URL Decode', input:encodeURIComponent(sample), output:sample},
];
async function download(page, filename) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button',{name:'Download output',exact:true}).click();
  const value = await pending;
  const destination = path.join(out, filename);
  await value.saveAs(destination);
  return await fs.readFile(destination);
}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true, executablePath:process.env.PDFPILOT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
  await context.route(/https?:\/\/(www\.)?(google-analytics|googletagmanager)\.com\//, route=>route.abort());
  const page=await context.newPage(); page.setDefaultTimeout(120000); page.setDefaultNavigationTimeout(180000); const errors=[]; const evidence=[];
  page.on('pageerror',error=>errors.push(error.message));
  async function visit(slug) {
    await page.goto(base+prefix+'/'+slug,{waitUntil:'domcontentloaded'});
    // The theme toggle changes its accessible name only after React mounts.
    await page.getByRole('button',{name:/^Switch to (dark|light) mode$/}).waitFor();
    await page.locator('#'+slug+'-input').waitFor();
  }
  async function run(config) { await page.getByRole('button',{name:config.action,exact:true}).click(); await page.getByRole('button',{name:'Download output',exact:true}).waitFor(); }
  try {
    for (const config of configs) {
      await visit(config.slug);
      assert.equal(await page.getByRole('button',{name:config.action,exact:true}).isDisabled(),true);
      await page.screenshot({path:path.join(out,config.slug+'-initial-1440-light.png'),fullPage:true});
      await page.locator('#'+config.slug+'-input').fill(config.input);
      await run(config);
      assert.equal(await page.locator('#'+config.slug+'-output').inputValue(),config.output);
      assert.deepEqual(await download(page,config.slug+'.txt'),Buffer.from(config.output));
      await page.getByRole('button',{name:'Copy output',exact:true}).click();
      await page.getByText('Output copied to clipboard.',{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),config.output);
      for (const width of [375,768,1440]) for (const theme of ['light','dark']) {
        await page.setViewportSize({width,height:1000});
        await page.evaluate(theme=>{document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.style.colorScheme=theme;},theme);
        // Capture the settled palette, not the 150ms color interpolation.
        await page.evaluate(()=>Promise.all(document.getAnimations().filter(animation=>animation instanceof CSSTransition).map(animation=>animation.finished.catch(()=>{}))));
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${config.slug} overflow ${width} ${theme}`);
        await page.screenshot({path:path.join(out,`${config.slug}-result-${width}-${theme}.png`),fullPage:true});
      }
      await page.getByRole('button',{name:'Reset all input and output'}).click();
      assert.equal(await page.locator('#'+config.slug+'-input').inputValue(),'');
      assert.equal(await page.locator('#'+config.slug+'-output').inputValue(),'');
      assert.equal(await page.getByRole('button',{name:'Download output',exact:true}).count(),0);
      evidence.push({tool:config.slug,unicodeRoundtrip:true,downloadBytes:Buffer.byteLength(config.output),clipboardExact:true,reset:true,widths:[375,768,1440],themes:['light','dark']});
    }
    await page.setViewportSize({width:1440,height:1000});
    await visit('base64-encode');
    await page.getByRole('button',{name:'File',exact:true}).click();
    const binary=Buffer.from(Array.from({length:256},(_,i)=>i));
    await page.locator('input[type=file]').setInputFiles({name:'very-long-binary-file-name-'.repeat(8)+'.bin',mimeType:'application/octet-stream',buffer:binary});
    await run(configs[0]);
    assert.deepEqual(await download(page,'raw-bytes.b64'),Buffer.from(binary.toString('base64')));
    await page.setViewportSize({width:375,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(out,'base64-encode-file-longname-375.png'),fullPage:true});
    await visit('base64-decode');
    await page.getByRole('button',{name:'File',exact:true}).click();
    await page.locator('input[type=file]').setInputFiles({name:'binary.b64',mimeType:'text/plain',buffer:Buffer.from(binary.toString('base64'))});
    await run(configs[1]);
    await page.getByText('This output contains binary data',{exact:false}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Copy output',exact:true}).count(),0);
    await page.getByLabel('Download filename',{exact:true}).fill('restored.bin');
    assert.deepEqual(await download(page,'restored.bin'),binary);
    await page.screenshot({path:path.join(out,'base64-decode-binary-375.png'),fullPage:true});
    evidence.push({check:'binary-file roundtrip',bytes:256,exact:true});

    for (const config of [configs[1],configs[3]]) {
      await visit(config.slug);
      await page.locator('#'+config.slug+'-input').fill(config.slug==='base64-decode'?'%%%':'%C3%28');
      await page.getByRole('button',{name:config.action,exact:true}).click();
      await page.getByRole('alert').filter({hasText:'Correct the input'}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Download output',exact:true}).count(),0);
      await page.screenshot({path:path.join(out,config.slug+'-error-375.png'),fullPage:true});
      await page.locator('#'+config.slug+'-input').fill(config.input);
      await run(config);
      assert.equal(await page.locator('#'+config.slug+'-output').inputValue(),config.output);
    }
    await visit('url-decode');
    await page.locator('#url-decode-input').fill('a+b%2Bc'); await run(configs[3]);
    assert.equal(await page.locator('#url-decode-output').inputValue(),'a+b+c');
    await page.getByRole('checkbox').check();
    assert.equal(await page.getByRole('button',{name:'Download output',exact:true}).count(),0);
    await run(configs[3]); assert.equal(await page.locator('#url-decode-output').inputValue(),'a b+c');

    await visit('url-encode'); await page.getByRole('button',{name:'File',exact:true}).click();
    await page.locator('input[type=file]').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from([255,254])});
    await page.getByRole('alert').filter({hasText:'not valid UTF-8'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'URL Encode',exact:true}).isDisabled(),true);
    const bomText='\ufeff'+sample;
    await page.locator('input[type=file]').setInputFiles({name:'unicode.txt',mimeType:'text/plain',buffer:Buffer.from(bomText)});
    await run(configs[2]); assert.deepEqual(await download(page,'utf8-file-encoded.txt'),Buffer.from(encodeURIComponent(bomText)));
    await page.locator('#url-encode-input').fill('edited & value');
    assert.equal(await page.getByRole('button',{name:'Download output',exact:true}).count(),0);
    await run(configs[2]); assert.equal(await page.locator('#url-encode-output').inputValue(),'edited%20%26%20value');
    const large='a '.repeat(550000);
    await page.locator('input[type=file]').setInputFiles({name:'large.txt',mimeType:'text/plain',buffer:Buffer.from(large)});
    await page.waitForFunction(()=>document.querySelector('#url-encode-input')?.readOnly === true);
    assert.equal(await page.locator('#url-encode-input').inputValue(),large.slice(0,100000));
    assert.equal(await page.locator('#url-encode-input').getAttribute('readonly'),'');
    await run(configs[2]); assert.deepEqual(await download(page,'large-complete-output.txt'),Buffer.from(encodeURIComponent(large)));
    evidence.push({check:'large file preview truncation',inputCharacters:large.length,previewCharacters:100000,completeDownloadBytes:Buffer.byteLength(encodeURIComponent(large))});
    evidence.push({check:'malformed input retry, UTF-8 error recovery, editable file text, plus setting',passed:true});
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify({base,prefix,nativeDeviceCertification:false,evidence,browserErrors:errors},null,2));
    console.log(JSON.stringify({out,evidence,browserErrors:errors},null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
