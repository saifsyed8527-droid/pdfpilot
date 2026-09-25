// Synthetic fixtures only; never commit private customer presentations.
const fs = require('node:fs/promises');
const path = require('node:path');
const PptxGenJS = require('pptxgenjs');
const sharp = require('sharp');
const { unzipSync, zipSync, strToU8, strFromU8 } = require('fflate');
async function main() {
  const out = await fs.mkdtemp('/private/tmp/pdfpilot-pptx-fixtures-');
  const pptx = new PptxGenJS(); pptx.layout='LAYOUT_WIDE';
  const first = pptx.addSlide();
  first.addText('Shapes, pictures and text', {x:.5,y:.3,w:10,h:.5,fontFace:'Arial',fontSize:28,bold:true});
  first.addShape(pptx.ShapeType.rect,{x:.5,y:1.2,w:2,h:1,fill:{color:'1565C0'},line:{color:'001122',width:2}});
  first.addShape(pptx.ShapeType.ellipse,{x:3,y:1.2,w:2,h:1,fill:{color:'F59E0B'},line:{color:'001122',width:2},rotate:30});
  const image=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="120" height="120" fill="#e11d48"/><rect x="120" width="120" height="120" fill="#16a34a"/></svg>')).png().toBuffer();
  first.addImage({data:'image/png;base64,'+image.toString('base64'),x:6,y:1.2,w:2,h:1,rotate:90});
  first.addText('First line\nSecond line',{x:.5,y:3,w:5,h:1,fontFace:'Arial',fontSize:22,color:'114477'});
  const second=pptx.addSlide();
  second.addText('Table widths and rows',{x:.5,y:.3,w:10,h:.5,fontFace:'Arial',fontSize:26});
  second.addTable([['Item','Description'],['A','Wide second column'],['B','Final row']],{x:.5,y:1.2,w:10,colW:[2,8],rowH:.6,fontFace:'Arial',fontSize:18,color:'111111',fill:'FFFFFF',border:{type:'solid',pt:1,color:'0F172A'},margin:4});
  const raw=new Uint8Array(await pptx.write({outputType:'uint8array'}));
  await fs.writeFile(path.join(out,'basic.pptx'),raw);
  const invalid=unzipSync(raw);
  invalid['ppt/slides/slide1.xml']=strToU8(strFromU8(invalid['ppt/slides/slide1.xml']).replaceAll('prst="rect"','prst="unsupportedFixtureShape"'));
  await fs.writeFile(path.join(out,'unsupported-shape.pptx'),zipSync(invalid));
  console.log(out);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
