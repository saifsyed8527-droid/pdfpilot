// Runs the real shared converters through every catalog entry, using only public samples.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PDFPILOT_PLAYWRIGHT_MODULE || 'playwright');
const { PDFDocument, PDFName } = require('pdf-lib');
const { unzipSync } = require('fflate');
const rows = require('../src/lib/content/conversion-templates.json');
const base = process.argv[2] || 'http://127.0.0.1:4330';
const writePreviews = process.argv.includes('--write-previews');
if (writePreviews && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Generate previews from the local build only');
const root = '/templates/conversions';
const near = (a,b) => assert.ok(Math.abs(a-b)<1,`${a} != ${b}`);
async function main() {
  const out = await fs.mkdtemp(path.join(os.tmpdir(),'pdfpilot-template-qa-'));
  const previewDir = path.resolve(__dirname,'../public/template-samples/previews');
  if(writePreviews) await fs.mkdir(previewDir,{recursive:true});
  const browser = await chromium.launch({headless:true,...(process.env.PDFPILOT_CHROME ? {executablePath:process.env.PDFPILOT_CHROME} : {})});
  const results=[];
  try {
    const page = await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});
    const errors=[],uploads=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.method()==='POST'&&request.url().startsWith(base)) uploads.push(request.url())});
    for(const row of rows) {
      const response=await page.goto(`${base}${root}/${row.tool}/${row.slug}`);
      assert.equal(response.status(),200);
      await page.getByRole('button',{name:'Try with sample files',exact:true}).click();
      const convert=page.getByRole('button',{name:'Convert to PDF',exact:true});
      await convert.waitFor({timeout:30000});
      assert.equal(await page.getByRole('heading',{level:1}).count(),1,'embedded workspace heading');
      if(row.preset) {
        assert.equal(await page.getByRole('checkbox',{name:/Merge all images/}).getAttribute('aria-checked'),String(row.preset.merge));
        assert.equal(await page.getByRole('button',{name:row.preset.orientation==='auto'?'Auto':row.preset.orientation==='portrait'?'Portrait':'Landscape',exact:true}).getAttribute('aria-pressed'),'true');
        assert.equal(await page.getByRole('button',{name:row.preset.margin==='none'?'No margin':row.preset.margin==='small'?'Small':'Big',exact:true}).getAttribute('aria-pressed'),'true');
      }
      const pending=page.waitForEvent('download',{timeout:120000});
      await convert.click();
      const download=await pending;
      const filename=path.join(out,`${row.tool}-${row.slug}${download.suggestedFilename().endsWith('.zip')?'.zip':'.pdf'}`);
      await download.saveAs(filename);
      const bytes=await fs.readFile(filename);
      const zip=filename.endsWith('.zip');
      const files=zip?Object.entries(unzipSync(bytes)).filter(([name])=>name.endsWith('.pdf')):[[path.basename(filename),bytes]];
      assert.equal(files.length,zip?row.samples.length:1);
      const dims=[];
      for(let i=0;i<files.length;i++) {
        const [name,data]=files[i];
        const pdf=await PDFDocument.load(data);
        if(row.tool==='jpg-to-pdf') assert.equal(pdf.getPageCount(),row.preset.merge?row.samples.length:1);
        if(row.tool==='word-to-pdf') assert.equal(pdf.getPageCount(),1,'sample Word page count');
        if(row.tool==='powerpoint-to-pdf') assert.equal(pdf.getPageCount(),row.slug==='vector-drawings'?1:2);
        const dimensions=pdf.getPages().map(p=>[p.getWidth(),p.getHeight()]);
        dims.push({name,pages:pdf.getPageCount(),dimensions});
        if(row.preset) {
          for(let j=0;j<dimensions.length;j++) {
            let expected=row.preset.pageSize==='a4'?[595.28,841.89]:row.preset.pageSize==='letter'?[612,792]:null;
            if(expected && row.preset.orientation==='landscape') expected.reverse();
            if(!expected) {
              const source=row.samples[row.preset.merge?j:i];
              expected=source==='portrait.jpg'?[450,675]:source==='landscape.jpg'?[675,450]:[450,180];
            }
            near(dimensions[j][0],expected[0]);near(dimensions[j][1],expected[1]);
          }
        }
        if(row.tool==='powerpoint-to-pdf') {
          const standard=row.slug==='standard-slides'||(row.slug==='batch-presentations'&&i===1);
          near(dimensions[0][0],standard?720:960);near(dimensions[0][1],540);
          assert.ok(pdf.getPages().every(p=>p.node.Contents()),'PDF content present');
        }
        if(row.tool==='word-to-pdf') {
          assert.equal(dimensions[0][0]>dimensions[0][1],row.slug==='landscape-document');
          assert.ok(pdf.getPages().some(p=>p.node.Resources()?.lookup(PDFName.of('XObject'))),'visual pages embedded');
          if(row.samples[i]==='table.docx') assert.ok(pdf.getPages().some(p=>p.node.Annots()?.size()>0),'clickable link retained');
        }
        const local=path.join(out,`${row.tool}-${row.slug}-${i}.pdf`);await fs.writeFile(local,data);
        // Render every page for visual QA; the website preview is the actual first result.
        execFileSync('pdftoppm',['-scale-to','900','-png',local,path.join(out,`${row.tool}-${row.slug}-${i}`)],{stdio:'pipe'});
        if(writePreviews&&i===0) execFileSync('pdftoppm',['-f','1','-singlefile','-scale-to','700','-png',local,path.join(previewDir,`${row.tool}-${row.slug}`)],{stdio:'pipe'});
      }
      results.push({tool:row.tool,slug:row.slug,zip,outputs:dims});
      console.log('PASS conversion',row.tool,row.slug,JSON.stringify(dims));
    }
    for(const dark of [false,true]) {
      await page.goto(base+root);await page.waitForLoadState('networkidle');
      await page.evaluate(dark=>{document.documentElement.classList.toggle('dark',dark)},dark);
      await page.getByRole('searchbox',{name:'Search conversion templates'}).fill('landscape');
      assert.equal(await page.locator('main').getByRole('status').textContent(),'3 templates');
      await page.getByRole('searchbox').fill('no such template xyz');assert.ok(await page.getByText('No matching template.',{exact:false}).isVisible());
      await page.getByRole('searchbox').fill('');
      for(const width of [1366,390]) {
        await page.setViewportSize({width,height:900});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'gallery overflow');
        await page.locator('main img').evaluateAll(async imgs=>{await Promise.all(imgs.map(async img=>{img.loading='eager';await img.decode();}));});
        await page.evaluate(()=>scrollTo(0,0));
        await page.screenshot({path:path.join(out,`gallery-${dark?'dark':'light'}-${width}.png`),fullPage:true});
      }
    }
    for(const row of [rows[0],rows.find(r=>r.tool==='word-to-pdf'),rows.find(r=>r.tool==='powerpoint-to-pdf')]) {
      await page.goto(`${base}${root}/${row.tool}/${row.slug}`);await page.waitForLoadState('networkidle');
      assert.equal(await page.getByRole('heading',{level:1}).count(),1);
      for(const width of [1366,390]) {
        await page.setViewportSize({width,height:900});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,row.slug+' overflow');
        await page.screenshot({path:path.join(out,`${row.tool}-${width}.png`),fullPage:true});
      }
      // Real file input (not only the sample button), editable image settings,
      // mobile selected-file workspace, and dark result links.
      await page.locator('input[type=file]').first().setInputFiles(row.samples.map(f=>path.resolve(__dirname,'../public/template-samples',f)));
      const convert=page.getByRole('button',{name:'Convert to PDF',exact:true});
      await convert.waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,row.tool+' mobile workspace overflow');
      assert.equal(await page.getByRole('heading',{level:1}).count(),1);
      if(row.preset) await page.getByRole('button',{name:'Landscape',exact:true}).click();
      await page.evaluate(()=>document.documentElement.classList.add('dark'));
      await page.screenshot({path:path.join(out,`${row.tool}-mobile-workspace-dark.png`),fullPage:true});
      const pending=page.waitForEvent('download',{timeout:120000});await convert.click();
      const download=await pending;
      if(row.preset) {
        const pdf=await PDFDocument.load(await fs.readFile(await download.path()));
        near(pdf.getPage(0).getWidth(),841.89);near(pdf.getPage(0).getHeight(),595.28);
      }
      const heading=page.getByText('Continue with your PDF',{exact:true});
      await heading.waitFor();
      const colors=await heading.evaluate(el=>{const parent=el.closest('.bg-card');return {fg:getComputedStyle(el).color,bg:parent&&getComputedStyle(parent).backgroundColor}});
      assert.notEqual(colors.fg,colors.bg);assert.notEqual(colors.bg,'rgb(255, 255, 255)','dark related-tool surface');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,row.tool+' mobile result overflow');
      await page.screenshot({path:path.join(out,`${row.tool}-mobile-result-dark.png`),fullPage:true});
      await page.getByRole('button',{name:/^Start over$/i}).click();
      await page.getByRole('button',{name:'Try with sample files',exact:true}).waitFor();
    }
    await page.goto(`${base}${root}/${rows[0].tool}/${rows[0].slug}`);
    await page.route('**/template-samples/portrait.jpg',route=>route.fulfill({status:503,body:'Unavailable'}));
    await page.getByRole('button',{name:'Try with sample files',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'The sample could not be loaded'}).waitFor();
    assert.equal(await page.locator('input[type=file]').isEnabled(),true,'own-file fallback remains available');
    await page.unroute('**/template-samples/portrait.jpg');
    assert.deepEqual(errors,[]);assert.deepEqual(uploads,[]);
    await fs.writeFile(path.join(out,'results.json'),JSON.stringify({base,checkedAt:new Date().toISOString(),results,errors,uploads},null,2));
    console.log('PASS all template conversions and UI checks. Evidence: '+out);
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1});
