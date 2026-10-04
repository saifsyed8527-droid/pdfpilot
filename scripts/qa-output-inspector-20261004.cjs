// Independent PDF output text and rendering inspection.
const fs=require('node:fs/promises');
const path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
async function inspectPDF(file, out, render=true) {
 const bytes=await fs.readFile(file);const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const doc=await pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;
 const result={bytes:bytes.length,pages:doc.numPages,text:[],sizes:[],renders:[]};
 for(let i=1;i<=doc.numPages;i++) {const page=await doc.getPage(i);result.text.push((await page.getTextContent()).items.map(x=>x.str||'').join(' '));const viewport=page.getViewport({scale:1});result.sizes.push([viewport.width,viewport.height]);if(render){const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;const name=path.basename(file)+`-page-${i}.png`;await fs.writeFile(path.join(out,name),canvas.toBuffer('image/png'));result.renders.push(name);}}
 await doc.cleanup();return result;
}
module.exports={inspectPDF};
