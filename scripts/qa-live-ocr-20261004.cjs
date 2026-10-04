// Fresh live OCR QA: retain POST bodies for review; distinguish exact GA collection metadata from document processing. No requests are blocked or changed.
const fs=require('fs'),path=require('path');
const root=process.cwd(), assert=require('node:assert/strict');
const {chromium}=require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const {PDFDocument}=require(path.join(root,'node_modules/pdf-lib'));const sharp=require(path.join(root,'node_modules/sharp'));
(async()=>{const out=process.env.PDFPILOT_QA_OUTPUT || path.join(root,'docs/qa/product-d-2026-10-04');
 fs.mkdirSync(out,{recursive:true}); const pdf=await PDFDocument.create();
 for(const [index,text] of ['PDFPilot OCR one 12345','Second scan page 67890'].entries()) {
 const svg=`<svg width="1200" height="700"><rect width="100%" height="100%" fill="white"/><text x="90" y="160" font-family="Arial" font-size="48">${text}</text><text x="90" y="280" font-family="Arial" font-size="36">Total: $42.75</text></svg>`;
 const img=await sharp(Buffer.from(svg)).png().toBuffer();fs.writeFileSync(path.join(out,`scan-${index+1}.png`),img); const im=await pdf.embedPng(img);const page=pdf.addPage([600,350]);page.drawImage(im,{x:0,y:0,width:600,height:350});page.drawText('Native footer 2468',{x:45,y:25,size:12}); }
 fs.writeFileSync(path.join(out,'scans.pdf'),await pdf.save());

 const browser=await chromium.launch({headless:true,...(process.env.PDFPILOT_CHROME?{executablePath:process.env.PDFPILOT_CHROME}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage();page.setDefaultTimeout(120000);const errors=[],checks=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'){
 const body=r.postDataBuffer()||Buffer.alloc(0), text=body.toString('utf8'), u=new URL(r.url());
 const contentType=r.headers()['content-type']||'';
 const metadataKeys=[...new URLSearchParams(text).keys()];
 const fieldsAreMetadata=metadataKeys.every(key=>/^(en|_ee|_et|ep\.(tool_name|error_message|method|value|search_term)|epn\.[a-z_]+)$/.test(key));
 const gaCollection=(u.hostname==='www.google-analytics.com'||u.hostname==='region1.google-analytics.com'||u.hostname==='analytics.google.com')&&u.pathname==='/g/collect';
 const hasDocumentMarker=/%PDF-|JVBERi|application\/pdf|multipart\/form-data|PDFPilot OCR one|Second scan page|iVBORw0KGgo|data:image/i.test(text+' '+contentType);
 const classified=gaCollection&&body.length<8192&&fieldsAreMetadata&&!hasDocumentMarker?'GA event metadata (review recorded body)':r.url()===base+'/__nextjs_original-stack-frames'?'Next local diagnostic':'requires investigation';
 requests.push({url:r.url(),contentType,bytes:body.length,body:text.slice(0,65536),bodySha256:require('node:crypto').createHash('sha256').update(body).digest('hex'),metadataKeys,hasDocumentMarker,classification:classified});
 }});
 const base=process.argv[2]||'http://127.0.0.1:4404';
 async function start(file='scans.pdf') {await page.goto(base+'/ocr-pdf');await page.getByRole('button',{name:/Switch to (dark|light) mode/}).waitFor();await page.locator('input[type=file]').first().setInputFiles(path.join(out,file));}
 try {
 await page.goto(base+'/ocr-pdf');await page.screenshot({path:path.join(out,'ocr-initial.png'),fullPage:true});
 await start();await page.getByText('2 pages',{exact:false}).first().waitFor();
 for(const width of [375,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);await page.screenshot({path:path.join(out,`ocr-loaded-${width}.png`),fullPage:true});}
 await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:path.join(out,'ocr-loaded-dark.png'),fullPage:true});await page.emulateMedia({colorScheme:'light'});
 await page.getByRole('button',{name:'Make PDF searchable',exact:true}).filter({visible:true}).first().click();await page.screenshot({path:path.join(out,'ocr-processing.png'),fullPage:true});
 const result=page.getByRole('button',{name:'Download searchable PDF',exact:true});await result.waitFor();
 const pending=page.waitForEvent('download');await result.click();const download=await pending;await download.saveAs(path.join(out,'ocr-after.pdf'));await page.screenshot({path:path.join(out,'ocr-result.png'),fullPage:true});
 await page.getByRole('button',{name:'Start over',exact:true}).click();await page.getByRole('heading',{name:'OCR PDF',exact:true}).first().waitFor();checks.push('result reset');
 await start();await page.getByText('2 pages',{exact:false}).first().waitFor();await page.getByRole('button',{name:'Make PDF searchable',exact:true}).filter({visible:true}).first().click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Make PDF searchable',exact:true}).filter({visible:true}).first().waitFor();assert.equal(await result.count(),0);await page.getByRole('button',{name:'Make PDF searchable',exact:true}).filter({visible:true}).first().click();await result.waitFor();checks.push('cancel then retry produces only new result');
 fs.writeFileSync(path.join(out,'malformed.pdf'),'%PDF-1.7 invalid');await start('malformed.pdf');await page.getByRole('alert').filter({hasText:'This PDF could not be read'}).waitFor();assert.equal(await page.getByRole('button',{name:'Make PDF searchable',exact:true}).filter({visible:true}).first().isDisabled(),true);await page.screenshot({path:path.join(out,'ocr-error.png'),fullPage:true});
 const replace=page.getByRole('button',{name:'Replace PDF file',exact:true});const chooser=page.waitForEvent('filechooser');await replace.click();await(await chooser).setFiles(path.join(out,'scans.pdf'));await page.getByText('2 pages',{exact:false}).first().waitFor();await page.getByRole('button',{name:'Make PDF searchable',exact:true}).filter({visible:true}).first().click();await result.waitFor();checks.push('malformed PDF disabled action and replacement recovery');
 assert.deepEqual(errors,[]);
 } catch(e){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-1800));throw e;}
 finally {fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({checks,errors,requests},null,2));await browser.close();}
 const pdfjs=await import(path.join(root,'node_modules/pdfjs-dist/legacy/build/pdf.mjs'));
 const output=fs.readFileSync(path.join(out,'ocr-after.pdf'));const loaded=pdfjs.getDocument({data:new Uint8Array(output),useSystemFonts:true,standardFontDataUrl:path.join(root,'node_modules/pdfjs-dist/standard_fonts/')});const parsed=await loaded.promise;
 assert.equal(parsed.numPages,2);const contents=[];for(let i=1;i<=2;i++)contents.push((await (await parsed.getPage(i)).getTextContent()).items);
 assert.match(contents[0].map(x=>x.str).join(' ').replace(/\s+/g,' '),/PDFPilot OCR one 12345/);assert.match(contents[1].map(x=>x.str).join(' ').replace(/\s+/g,' '),/Second scan page 67890/);
 assert.match(contents[0].map(x=>x.str).join(' ').replace(/\s+/g,' '),/42.75/);assert.equal(contents[0].filter(x=>x.str.includes('Native')).length,1,'native footer must not be duplicated');const first=contents[0].find(x=>x.str==='PDFPilot');assert.ok(Math.abs(first.transform[4]-45)<4&&Math.abs(first.transform[5]-270)<5,JSON.stringify(first));
 const {createCanvas}=require(path.join(root,'node_modules/@napi-rs/canvas'));
 const sourceLoading=pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(path.join(out,'scans.pdf'))),useSystemFonts:true,standardFontDataUrl:path.join(root,'node_modules/pdfjs-dist/standard_fonts/')});const source=await sourceLoading.promise;
 for(let i=1;i<=2;i++){const rendered=[];for(const doc of [source,parsed]){const p=await doc.getPage(i),viewport=p.getViewport({scale:1}),canvas=createCanvas(viewport.width,viewport.height);await p.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;rendered.push(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data);}let changed=0;for(let k=0;k<rendered[0].length;k++)if(rendered[0][k]!==rendered[1][k])changed++;assert.equal(changed,0,`page ${i}: ${changed} changed channels of ${rendered[0].length}`);}
 await sourceLoading.destroy();await loaded.destroy();checks.push('two-page English OCR: text, order, bbox alignment and byte-identical visible page pixels');
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({checks,errors,requests},null,2));
 assert.deepEqual(requests.filter(request=>request.classification==='requires investigation'),[], 'Unclassified POSTs: inspect saved request evidence; do not blanket-ignore analytics');
 console.log(JSON.stringify({checks,errors,requests}));
})().catch(e=>{console.error(e);process.exitCode=1});
