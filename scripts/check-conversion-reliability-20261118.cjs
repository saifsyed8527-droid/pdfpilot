const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const {PDFDocument,rgb,StandardFonts}=require('pdf-lib');
const {createCanvas}=require('@napi-rs/canvas');
const {unzipSync,strFromU8}=require('fflate');
const out=path.resolve(process.env.PDFPILOT_QA_OUTPUT || 'docs/qa/2026-11-18-conversion');
const base=process.env.PDFPILOT_QA_BASE || 'http://127.0.0.1:4428';
(async()=>{
await fs.mkdir(out,{recursive:true});
const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
for(let i=1;i<=4;i++){const page=pdf.addPage([600,440]);const canvas=createCanvas(320,200),ctx=canvas.getContext('2d');ctx.fillStyle=['#ec4141','#2868d8','#23a062','#9340ba'][i-1];ctx.fillRect(0,0,320,200);ctx.fillStyle='white';ctx.font='40px sans-serif';ctx.fillText('PICTURE '+i,35,105);const im=await pdf.embedPng(canvas.toBuffer('image/png'));page.drawImage(im,{x:40,y:70,width:320,height:200});page.drawText('PDF PILOT PAGE '+i,{x:40,y:360,size:26,font,color:rgb(0,0,0)});}
const fixture=path.join(out,'four-page-text-images.pdf');await fs.writeFile(fixture,await pdf.save());
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/google-analytics|googletagmanager|clarity\.ms/,r=>r.abort());
try{
await page.goto(base+'/pdf-to-powerpoint',{waitUntil:'domcontentloaded',timeout:180000});await page.locator('input[type=file]').first().waitFor({state:'attached',timeout:120000});await page.getByRole('button',{name:/Switch to (dark|light) mode/}).waitFor({timeout:60000}); const chooser=page.waitForEvent('filechooser'); await page.getByRole('button',{name:'Select PDF file',exact:true}).click(); await(await chooser).setFiles(fixture);
await page.getByRole('button',{name:'Convert to PPTX',exact:true}).waitFor({timeout:60000});await page.screenshot({path:path.join(out,'pdf-ppt-options.png'),fullPage:true});
const dl=page.waitForEvent('download',{timeout:180000});await page.getByRole('button',{name:'Convert to PPTX',exact:true}).click();const deck=path.join(out,'four-pages.pptx');await(await dl).saveAs(deck);await page.screenshot({path:path.join(out,'pdf-ppt-result.png'),fullPage:true});
const entries=unzipSync(await fs.readFile(deck)),slides=Object.keys(entries).filter(k=>/^ppt\/slides\/slide\d+\.xml$/.test(k)).sort();assert.equal(slides.length,4);const pictures=[];
for(let i=0;i<4;i++){const xml=strFromU8(entries[slides[i]]);assert.match(xml,new RegExp('PDF PILOT PAGE '+(i+1)));assert.match(xml,/<p:pic>/);const rels=strFromU8(entries['ppt/slides/_rels/slide'+(i+1)+'.xml.rels']);const target=rels.match(/Type="[^"]*\/image" Target="([^"]+)"/);assert.ok(target,rels);const key=path.posix.normalize('ppt/slides/'+target[1]);assert.ok(entries[key]);const hash=crypto.createHash('sha256').update(entries[key]).digest('hex');pictures.push(hash);await fs.writeFile(path.join(out,'slide-'+(i+1)+'.jpeg'),entries[key]);}assert.equal(new Set(pictures).size,4);
await page.goto(base+'/powerpoint-to-pdf',{waitUntil:'domcontentloaded',timeout:180000});await page.locator('input[type=file]').first().waitFor({state:'attached',timeout:120000});await page.getByRole('button',{name:/Switch to (dark|light) mode/}).waitFor({timeout:60000}); const chooser2=page.waitForEvent('filechooser'); await page.getByRole('button',{name:'Select PowerPoint files',exact:true}).click(); await(await chooser2).setFiles(deck);await page.getByRole('button',{name:'Convert to PDF',exact:true}).waitFor();
const dl2=page.waitForEvent('download',{timeout:180000});await page.getByRole('button',{name:'Convert to PDF',exact:true}).click();const round=path.join(out,'roundtrip.pdf');await(await dl2).saveAs(round);await page.screenshot({path:path.join(out,'ppt-pdf-result.png'),fullPage:true});
const roundPdf=await PDFDocument.load(await fs.readFile(round));assert.equal(roundPdf.getPageCount(),4);
const report={host:{platform:process.platform,browser:browser.version()},base,sourcePages:4,pptxSlides:4,distinctImages:4,roundtripPages:4,errors,checkedAt:new Date().toISOString(),limits:'Development app; synthetic file; not production or Microsoft PowerPoint validation'};assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(report);
}catch(e){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-7000));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
