const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PDFPILOT_PLAYWRIGHT_MODULE||'playwright');
const {PDFDocument,StandardFonts}=require('pdf-lib');const sharp=require('sharp');const {unzipSync,strFromU8}=require('fflate');
const base=process.argv[2]||'http://127.0.0.1:4368',out=process.argv[3]||'docs/pseo/qa/functional';
(async()=>{
 await fs.mkdir(out,{recursive:true});const errors=[],results=[],outbound=[];
 const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);
 for(let i=1;i<=3;i++){const p=pdf.addPage([595,842]);p.drawText(`PDFPilot QA page ${i}`,{x:45,y:750,size:24,font});p.drawText('Item       Count       Price',{x:45,y:680,size:14,font});p.drawText('Sample     2           25',{x:45,y:650,size:14,font});}
 const pdfPath=path.join(out,'fixture.pdf');await fs.writeFile(pdfPath,await pdf.save());
 const png=path.join(out,'fixture.png');await sharp({create:{width:300,height:200,channels:4,background:{r:20,g:150,b:90,alpha:.6}}}).png().toFile(png);
 const XLSX=require('xlsx');const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Name','Count'],['QA SAMPLE',2]]),'Sheet1');const xlsx=path.join(out,'fixture.xlsx');XLSX.writeFile(book,xlsx);
 const {Document,Paragraph,Packer}=require('docx');const docx=path.join(out,'fixture.docx');await fs.writeFile(docx,await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('PDFPilot QA document')]}]})));
 const browser=await chromium.launch({headless:true,...(process.env.PDFPILOT_CHROME?{executablePath:process.env.PDFPILOT_CHROME}:{})});
 const context=await browser.newContext({viewport:{width:1366,height:900},acceptDownloads:true,reducedMotion:'reduce'});
 await context.route('https://**/*',r=>r.abort());const page=await context.newPage();page.setDefaultTimeout(30000);
 page.on('pageerror',e=>errors.push({url:page.url(),error:e.message}));page.on('request',r=>{if(r.method()==='POST')outbound.push(r.url());});
 const go=async route=>{const response=await page.goto(base+route,{waitUntil:'networkidle'});assert.equal(response.status(),200,route);};
 async function convert(route,files,action,downloadName,kind,expectedPages){
  await go(route);await page.locator('input[type=file]').first().setInputFiles(files);
  await page.getByRole('button',{name:action,exact:true}).click();
  const button=page.getByRole('button',{name:downloadName,exact:true});await button.waitFor({timeout:120000});
  const pending=page.waitForEvent('download');await button.click();const download=await pending;
  const file=path.join(out,route.replaceAll('/','_')+path.extname(download.suggestedFilename()));await download.saveAs(file);
  const bytes=await fs.readFile(file);
  if(kind==='pdf'){const result=await PDFDocument.load(bytes);assert.equal(result.getPageCount(),expectedPages);}
  if(kind==='docx'){const zip=unzipSync(bytes);assert.match(strFromU8(zip['word/document.xml']),/PDFPilot QA page/);}
  if(kind==='xml')assert.match(bytes.toString(),/QA SAMPLE/);
  results.push({route,bytes:bytes.length,download:download.suggestedFilename(),kind});console.log('PASS',route);
 }
 try{
  await convert('/merge-pdf',[pdfPath,pdfPath],'Merge 2 PDFs','Download PDF','pdf',6);
  await convert('/jpg-to-pdf',png,'Convert to PDF','Download PDF','pdf',1);
  await convert('/compress-pdf',pdfPath,'Compress PDF','Download PDF','pdf',3);
  await convert('/split-pdf',pdfPath,'Split PDF','Download PDF','pdf',3);
  await convert('/word-to-pdf',docx,'Convert to PDF','Download PDF','pdf',1);
  await convert('/pdf-to-word',pdfPath,'Convert to WORD','Download Word','docx');
  await convert('/add-page-numbers',pdfPath,'Add page numbers','Download','pdf',3);
  await convert('/excel-to-xml',xlsx,'Convert files','Download file','xml');
  // Test renderer with the real upload/process/download flows through local, noindex previews.
  if(process.env.PSEO_QA_PREVIEW==='1'){
   for(const [slug,files,action,download,kind,count]of [['png-to-pdf',png,'Convert to PDF','Download PDF','pdf',1],['merge-pdf-on-mac',[pdfPath,pdfPath],'Merge 2 PDFs','Download PDF','pdf',6],['compress-pdf-for-email',pdfPath,'Compress PDF','Download PDF','pdf',3]]){
    const route='/pseo-preview/'+slug;await go(route);
    assert.equal(await page.locator('h1').count(),1);assert.match(await page.locator('meta[name=robots]').getAttribute('content'),/noindex/);
    const html=await (await context.request.get(base+route)).text();assert.match(html,/How to complete this task/);assert.match(html,/Processing and privacy/);
    for(const script of await page.locator('script[type="application/ld+json"]').allTextContents())JSON.parse(script);
    for(const width of [390,768,1366])for(const theme of ['light','dark']){
     await page.setViewportSize({width,height:900});
     await page.getByRole('button',{name:/^Switch to (dark|light) mode$/}).waitFor();
     const toggle=page.getByRole('button',{name:theme==='dark'?'Switch to dark mode':'Switch to light mode',exact:true});if(await toggle.count())await toggle.click();
     assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('dark')),theme==='dark');
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' overflow '+width);
     await page.screenshot({path:path.join(out,`${slug}-${width}-${theme}.png`),animations:'disabled'});
    }
    await page.setViewportSize({width:1366,height:900});await convert(route,files,action,download,kind,count);
   }
  }
  // Invalid file recovery does not replace the tool or silently process corrupt bytes.
  await go('/merge-pdf');await page.locator('input[type=file]').first().setInputFiles({name:'invalid.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a pdf')});
  await page.getByText("Couldn't read this file",{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Merge 1 PDFs',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  await page.getByRole('heading',{level:1,name:'Merge PDF'}).waitFor();
  assert.equal((await context.request.get(base+'/not-a-real-pseo-task')).status(),404);
  assert.equal((await context.request.get(base+'/compress-pdf-to-100kb')).status(),404);
  assert.equal((await context.request.get(base+'/heic-to-pdf')).status(),404);
 }catch(error){results.push({failure:error.stack,url:page.url(),buttons:await page.getByRole('button').allTextContents()});throw error;}
 finally{await fs.writeFile(path.join(out,'results.json'),JSON.stringify({results,errors,outbound},null,2));await browser.close();}
 assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
})().catch(e=>{console.error(e);process.exitCode=1});
