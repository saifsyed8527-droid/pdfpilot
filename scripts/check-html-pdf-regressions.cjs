const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const { PDFDocument } = require('pdf-lib');
const base=process.argv[2] || 'http://127.0.0.1:3118';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('Use a local preview');
const svg='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><path fill="red" d="M0 0h400v200H0z"/><path fill="blue" d="M0 200h400v200H0z"/></svg>').toString('base64');
const html=`<!doctype html><html><head><style>body{margin:0}header{height:50vh;background:#16a34a}img{display:block;width:400px;height:200px;object-fit:cover;object-position:50% 100%}main{height:2500px;background:#facc15}footer{height:300px;background:#000}a{display:block;color:white}</style></head><body><header>VIEWPORT HERO</header><img src="${svg}"><main><a href="https://example.com/test">Working link</a>CONTENT</main><footer>LAST SECTION</footer><script>parent.__untrustedRan=true</script></body></html>`;
(async()=>{
 const out=await fs.mkdtemp('/tmp/pdfpilot-html-regression-'); console.log('OUTPUT',out);
 const browser=await chromium.launch({headless:true,executablePath:process.env.PDFPILOT_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  await page.exposeFunction('qaToast',text=>console.log('TOAST',text));
  await page.addInitScript(()=>{new MutationObserver(()=>{document.querySelectorAll('[data-sonner-toast]').forEach(t=>{if(!t.dataset.qaSeen){t.dataset.qaSeen='true';window.qaToast(t.textContent)}})}).observe(document,{childList:true,subtree:true})});
  async function load(content){
   await page.goto(base+'/html-to-pdf');await page.waitForLoadState('networkidle');
   await page.getByRole('button',{name:'Add HTML',exact:true}).click();
   await page.getByRole('button',{name:'HTML file',exact:true}).click();
   await page.locator('input[type=file]').setInputFiles({name:'render-test.html',mimeType:'text/html',buffer:Buffer.from(content)});
   await page.waitForFunction(()=>{const f=document.querySelector('iframe[title="HTML preview"]');return f?.contentDocument?.readyState==='complete'});
   assert.equal(await page.evaluate(()=>window.__untrustedRan),undefined);
  }
  async function download(name){const pending=page.waitForEvent('download',{timeout:30000});await page.getByRole('button',{name:'Convert to PDF',exact:true}).click();const d=await pending.catch(async error=>{console.log(name,await page.locator('body').innerText());throw error});await d.saveAs(path.join(out,name));return PDFDocument.load(await fs.readFile(path.join(out,name)));}
  await load(html);
  let pdf=await download('long.pdf');assert.equal(pdf.getPageCount(),1);assert.ok(Math.abs(pdf.getPage(0).getHeight()-3500*595/1440)<1);assert.equal(pdf.getPage(0).node.Annots().size(),1);
  await load(html);
  await page.getByRole('checkbox',{name:'One long page'}).uncheck();
  await page.getByRole('tab',{name:'Landscape',exact:true}).click();
  await page.getByRole('tab',{name:'Small',exact:true}).click();
  pdf=await download('paged.pdf');assert.ok(pdf.getPageCount()>1);
  for(const p of pdf.getPages()){assert.equal(p.getWidth(),842);assert.equal(p.getHeight(),595);}
  await page.setViewportSize({width:390,height:844});await load(html);
  await page.getByRole('combobox').first().selectOption('1920');
  await page.waitForFunction(()=>document.querySelector('iframe[title="HTML preview"]').contentWindow.innerWidth===1920);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.evaluate(()=>document.documentElement.classList.add('dark'));
  await page.screenshot({path:path.join(out,'mobile-dark.png'),fullPage:true});
  pdf=await download('desktop-from-mobile.pdf');assert.ok(Math.abs(pdf.getPage(0).getHeight()-(422+200+2500+300)*595/1920)<1);
  await page.setViewportSize({width:1440,height:1000});await load(html.replace('2500px','100000px'));
  let downloads=0;page.on('download',()=>downloads++);
  await page.getByRole('button',{name:'Convert to PDF',exact:true}).click();
  await page.getByText(/too tall for one PDF page/).first().waitFor();assert.equal(downloads,0);
  await load(html.replace(svg,'data:image/png;base64,broken'));
  await page.getByRole('button',{name:'Convert to PDF',exact:true}).click();
  await page.getByText(/image is missing/).first().waitFor();assert.equal(downloads,0);
  console.log('PASS: viewport sizing, margins, fixed paper pages, links, mobile/dark UI, disabled scripts, missing-image and oversized-page errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
