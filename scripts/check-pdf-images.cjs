const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PDFPILOT_PLAYWRIGHT_MODULE||'playwright');
const {PDFDocument,StandardFonts,degrees,pushGraphicsState,popGraphicsState,scale,drawObject}=require('pdf-lib');
const sharp=require('sharp'); const {unzipSync}=require('fflate');
const {load}=require('./load-pseo-modules.cjs');
const {PDF_IMAGE_COPY}=load('src/lib/i18n/pdf-image-copy.ts');
const {LOCALES}=load('src/lib/i18n/locales.ts');
const {CORE_PAGE_PATHS}=load('src/lib/i18n/core-content.ts');
const localizedCorePath=(key,code)=>'/'+[LOCALES.find(l=>l.code===code).segment,CORE_PAGE_PATHS[code][key]].filter(Boolean).join('/');
const base=process.argv[2]||'http://127.0.0.1:4371',out=path.resolve('docs/qa/pdf-images-2026-09-29');
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const raster=Buffer.alloc(120*80*4);for(let y=0;y<80;y++)for(let x=0;x<120;x++){const i=(y*120+x)*4;raster[i]=x*2;raster[i+1]=y*3;raster[i+2]=80;raster[i+3]=x<60?255:128;}
 const png=await sharp(raster,{raw:{width:120,height:80,channels:4}}).png().toBuffer();
 const jpeg=await sharp({create:{width:96,height:64,channels:3,background:'#2244cc'}}).jpeg({quality:100}).toBuffer();
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),p=pdf.addPage([400,300]);
 p.drawText('PDFPilot quality test 0123456789',{x:20,y:270,size:13,font});
 p.drawText('Small text stays sharp',{x:20,y:252,size:7,font});
 const embedded=await pdf.embedPng(png),embeddedJpg=await pdf.embedJpg(jpeg);
 p.drawImage(embedded,{x:20,y:80,width:240,height:160});p.drawImage(embedded,{x:280,y:150,width:60,height:40});p.drawImage(embeddedJpg,{x:280,y:40,width:96,height:64});
 const second=pdf.addPage([200,300]);second.setRotation(degrees(90));second.drawText('Rotated page',{x:15,y:220,size:18,font});
 const fixture=path.join(out,'quality.pdf');await fs.writeFile(fixture,await pdf.save());
 const textOnly=await PDFDocument.create();textOnly.addPage([400,300]).drawText('No raster images');const textPath=path.join(out,'text-only.pdf');await fs.writeFile(textPath,await textOnly.save());
 const huge=await PDFDocument.create();huge.addPage([10000,10000]);const hugePath=path.join(out,'oversized.pdf');await fs.writeFile(hugePath,await huge.save());
 const corrupt=path.join(out,'corrupt.pdf');await fs.writeFile(corrupt,'%PDF-1.7 invalid contents');
 // Lossless 64x48 solid-colour JPEG2000 generated with Pillow/OpenJPEG, embedded as JPX.
 const jp2=Buffer.from('AAAADGpQICANCocKAAAAFGZ0eXBqcDIgAAAAAGpwMiAAAAAtanAyaAAAABZpaGRyAAAAMAAAAEAAAwcHAAAAAAAPY29scgEAAAAAABAAAAC6anAyY/9P/1EALwAAAAAAQAAAADAAAAAAAAAAAAAAAEAAAAAwAAAAAAAAAAAAAwcBAQcBAQcBAf9SAAwAAAABAAUEBAAB/1wAE0BASEhQSEhQSEhQSEhQSEhQ/2QAJQABQ3JlYXRlZCBieSBPcGVuSlBFRyB2ZXJzaW9uIDIuNS40/5AACgAAAAAAMwAB/5PPtBQIgY0Af8fUCAiPnp3H1AgBzMkfgICAgICAgICAgICAgICA/9k=','base64');
 const jpxPdf=await PDFDocument.create(),jpxPage=jpxPdf.addPage([64,48]);
 const jpxRef=jpxPdf.context.register(jpxPdf.context.stream(jp2,{Type:'XObject',Subtype:'Image',Width:64,Height:48,ColorSpace:'DeviceRGB',BitsPerComponent:8,Filter:'JPXDecode'}));
 const jpxName=jpxPage.node.newXObject('JPX',jpxRef);jpxPage.pushOperators(pushGraphicsState(),scale(64,48),drawObject(jpxName),popGraphicsState());
 const jpxPath=path.join(out,'jpeg2000.pdf');await fs.writeFile(jpxPath,await jpxPdf.save());
 const browser=await chromium.launch({headless:true,...(process.env.PDFPILOT_CHROME?{executablePath:process.env.PDFPILOT_CHROME}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await context.route('https://**/*',r=>r.abort());
 const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[],posts=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
 async function start(files=fixture,route='/pdf-to-jpg') {await page.goto(base+route,{waitUntil:'networkidle',timeout:120000});const [picker]=await Promise.all([page.waitForEvent('filechooser'),page.locator('.pdf-tool-landing [role=button]').click()]);await picker.setFiles(files);}
 async function download(label='Download images (ZIP)') {await page.getByRole('button',{name:'Export images',exact:true}).click();const button=page.getByRole('button',{name:label,exact:true});await button.waitFor({timeout:120000});const pending=page.waitForEvent('download');await button.click();const file=await pending;const dest=path.join(out,file.suggestedFilename());await file.saveAs(dest);return fs.readFile(dest);}
 try {
  await start();await page.getByRole('img',{name:'quality.pdf',exact:true}).waitFor();assert.equal(await page.locator('iframe').count(),0);
  assert.equal(await page.getByRole('button',{name:'High detail · 300 DPI',exact:true}).getAttribute('aria-pressed'),'true');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,`workspace-${width}.png`),fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});const jpgs=unzipSync(await download());assert.equal(Object.keys(jpgs).length,2);
  const jpgMeta=await Promise.all(Object.values(jpgs).map(b=>sharp(b).metadata()));assert.deepEqual(jpgMeta.map(m=>[m.width,m.height]),[[1667,1250],[1250,834]]);
  await page.screenshot({path:path.join(out,'result.png'),fullPage:true});checks.push({test:'300-DPI JPG, thumbnail and rotated page',dimensions:jpgMeta.map(m=>[m.width,m.height])});
  await start();await page.getByRole('button',{name:'PNG',exact:true}).click();const pngs=unzipSync(await download());const fullPNG=Object.values(pngs)[0];
  const jpgPixels=await sharp(Object.values(jpgs)[0]).removeAlpha().raw().toBuffer(),pngPixels=await sharp(fullPNG).removeAlpha().raw().toBuffer();assert.equal(jpgPixels.length,pngPixels.length);
  let sum=0;for(let i=0;i<jpgPixels.length;i++)sum+=Math.abs(jpgPixels[i]-pngPixels[i]);const meanError=sum/jpgPixels.length;assert.ok(meanError<3,`JPEG mean channel error ${meanError}`);checks.push({test:'JPG 98% versus lossless page render',meanAbsoluteChannelError:meanError});
  await start();await page.getByRole('button',{name:'Smaller files · 150 DPI',exact:true}).click();const smaller=unzipSync(await download());assert.equal((await sharp(Object.values(smaller)[0]).metadata()).width,834);checks.push({test:'150 DPI explicitly selected',passed:true});
  await start();await page.getByRole('button',{name:/^Embedded images/}).click();await page.getByRole('button',{name:'PNG',exact:true}).click();const extracted=unzipSync(await download());assert.equal(Object.keys(extracted).length,2,'repeated image deduplicated, vector-only second page skipped');
  const raw=await sharp(Object.values(extracted)[0]).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(raw.info.width,120);assert.equal(raw.info.height,80);
  // Soft-mask alpha and source opaque pixels must survive lossless extraction.
  for(const [x,y] of [[10,10],[30,40],[90,20]]){const i=(y*120+x)*4;for(let c=0;c<4;c++)assert.ok(Math.abs(raw.data[i+c]-raster[i+c])<=1,`source pixel ${x},${y},${c}`);}
  assert.equal((await sharp(Object.values(extracted)[1]).metadata()).width,96);checks.push({test:'native PNG/JPEG extraction with alpha, repeated image, no page fallback',passed:true});
  await start(jpxPath);await page.getByRole('button',{name:/^Embedded images/}).click();await page.getByRole('button',{name:'PNG',exact:true}).click();
  const jpxOutput=await sharp(await download('Download images')).removeAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([jpxOutput.info.width,jpxOutput.info.height],[64,48]);
  for(let i=0;i<jpxOutput.data.length;i++)assert.ok(Math.abs(jpxOutput.data[i]-[12,90,180][i%3])<=1,'JPEG2000 colour fidelity');
  checks.push({test:'JPEG2000 extraction with local decoder and source colour fidelity',passed:true});
  await start([fixture,fixture]);const duplicates=unzipSync(await download());assert.equal(Object.keys(duplicates).length,4);checks.push({test:'duplicate filenames retain every page in ZIP',passed:true});
  for(const [file,mode,message] of [[textPath,'images',PDF_IMAGE_COPY.en.empty],[hugePath,'pages',PDF_IMAGE_COPY.en.large],[corrupt,'pages',PDF_IMAGE_COPY.en.invalid]]){await start(file);if(mode==='images')await page.getByRole('button',{name:/^Embedded images/}).click();await page.getByRole('button',{name:'Export images',exact:true}).click();await page.getByRole('alert').filter({hasText:message}).waitFor();assert.equal(await page.getByRole('button',{name:/^Download images/}).count(),0);checks.push({test:path.basename(file)+' explicit failure',passed:true});}
  for(const locale of LOCALES){const copy=PDF_IMAGE_COPY[locale.code],route=localizedCorePath('pdfToJpg',locale.code);await start(fixture,route);await page.getByRole('heading',{name:copy.options,exact:true}).waitFor();await page.getByRole('button',{name:copy.high,exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:copy.high,exact:true}).getAttribute('aria-pressed'),'true');await page.setViewportSize({width:390,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),locale.code+' overflow');if(['en','pt-BR','hi','ar'].includes(locale.code))await page.screenshot({path:path.join(out,locale.segment+'-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});checks.push({test:'localized controls and mobile layout',locale:locale.code,route});}
  assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);
 } catch(error){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-7000));throw error;}
 finally {await fs.writeFile(path.join(out,'results.json'),JSON.stringify({checks,errors,posts},null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({passed:checks.length,errors,posts}));
})().catch(e=>{console.error(e);process.exitCode=1});
