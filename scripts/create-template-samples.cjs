// Original public samples only. Never reads customer documents. Manual generator.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, ExternalHyperlink, WidthType, PageOrientation, ShadingType } = require('docx');
const PptxGenJS = require('pptxgenjs');
const out = path.resolve(__dirname, '../public/template-samples');
const art = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240"><rect x="20" y="20" width="220" height="200" rx="20" fill="#0f766e"/><circle cx="400" cy="120" r="95" fill="#f59e0b"/></svg>';
const title = text => new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text, bold: true, size: 36, color: '0F766E', font: 'Arial' })] });
const p = text => new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text, size: 24, font: 'Arial' })] });
function table(rows, widths) {
  return new Table({ width: { size: widths.reduce((a,b)=>a+b,0), type: WidthType.DXA }, columnWidths: widths, rows: rows.map((row,i)=>new TableRow({ children: row.map((text,j)=>new TableCell({ width:{size:widths[j],type:WidthType.DXA}, shading:{type:ShadingType.CLEAR,fill:i===0?'CCFBF1':'FFFFFF'}, children:[p(text)] })) })) });
}
async function word(name, children, landscape=false) {
  const doc = new Document({ creator: 'PDFPilot', title: 'PDFPilot demonstration sample', sections: [{ properties: { page: { size: { width:11906, height:16838, ...(landscape ? { orientation: PageOrientation.LANDSCAPE } : {}) }, margin: { top:900,bottom:900,left:900,right:900 } } }, children }] });
  await fs.writeFile(path.join(out,name), await Packer.toBuffer(doc));
}
async function deck(name, wide, drawing=false, picture) {
  const pres = new PptxGenJS(); pres.layout = wide ? 'LAYOUT_WIDE' : 'LAYOUT_4x3'; pres.author='PDFPilot'; pres.subject='Original public conversion sample'; pres.title='PDFPilot conversion sample';
  const width=wide?13.333333:10;
  const slide=pres.addSlide(); slide.background={color:'FFFFFF'};
  slide.addText(drawing?'Vector drawing sample':wide?'Widescreen sample':'Standard 4:3 sample',{x:.5,y:.4,w:width-1,h:.7,fontFace:'Arial',fontSize:32,bold:true,color:'0F766E',margin:0});
  if(drawing) {
    for(let i=0;i<3;i++) {
      slide.addShape(i===2?pres.ShapeType.ellipse:pres.ShapeType.rect,{x:.7+i*3.5,y:2,w:2.7,h:2.2,line:{color:'0F766E',width:2},fill:{color:'F0FDFA'}});
      slide.addText(['Room A','Room B','Meeting'][i],{x:.8+i*3.5,y:2.8,w:2.5,h:.5,fontFace:'Arial',fontSize:20,color:'0F172A',align:'center',margin:0});
    }
    slide.addText('Three labeled vector shapes. Inspect the outlines at high zoom.',{x:.5,y:5.5,w:width-1,h:.7,fontFace:'Arial',fontSize:18,margin:0,color:'334155'});
  } else {
    slide.addImage({data:'image/png;base64,'+picture.toString('base64'),x:.5,y:1.7,w:5,h:2});
    slide.addText('Embedded image, readable text and original slide dimensions.',{x:.5,y:4.6,w:width-1,h:1,fontFace:'Arial',fontSize:22,margin:0,color:'334155'});
    const second=pres.addSlide();
    second.addText('Compare every table row',{x:.5,y:.5,w:width-1,h:.6,fontFace:'Arial',fontSize:30,color:'0F766E',bold:true,margin:0});
    // Match the table frame to the four explicit row heights (PptxGenJS otherwise
    // emits a one-inch frame around 2.8 inches of rows).
    second.addTable([['Stage','Result'],['Choose files','Local browser input'],['Convert','PDF output'],['Review','Check both slides']],{x:.5,y:1.8,w:width-1,h:2.8,colW:[2.5,width-3.5],rowH:.7,fontFace:'Arial',fontSize:18,margin:8,color:'0F172A',fill:'FFFFFF',border:{color:'94A3B8',pt:1}});
  }
  await pres.writeFile({fileName:path.join(out,name)});
}
async function main() {
  await fs.mkdir(out,{recursive:true});
  const image = await sharp(Buffer.from(art)).png().toBuffer();
  await fs.writeFile(path.join(out,'transparent.png'), image);
  for(const [name,w,h] of [['portrait.jpg',600,900],['landscape.jpg',900,600]]) {
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#f0fdfa"/><rect x="30" y="30" width="${w-60}" height="${h-60}" fill="none" stroke="#0f766e" stroke-width="8"/><circle cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)*.27}" fill="#f59e0b"/><text x="${w/2}" y="90" text-anchor="middle" font-family="Arial" font-size="30" fill="#0f172a">${w} × ${h} · PDFPilot sample</text></svg>`;
    await sharp(Buffer.from(svg)).jpeg({quality:92}).toFile(path.join(out,name));
  }
  await word('table.docx',[title('Table conversion sample'),p('Check the header, all four data rows and the link below.'),table([['Item','Quantity'],['Notebook','2'],['Pen','4'],['Folder','1'],['Envelope','3']],[4000,4000]),p('End of table — all four items must be visible.'),new Paragraph({children:[new ExternalHyperlink({link:'https://pdfpilot.net/word-to-pdf',children:[new TextRun({text:'PDFPilot Word to PDF',style:'Hyperlink'})]})]})]);
  await word('illustrated.docx',[title('Embedded picture sample'),p('The picture is stored inside this document.'),new Paragraph({children:[new ImageRun({type:'png',data:image,transformation:{width:500,height:200}})]}),p('Caption: teal rectangle on the left, orange circle on the right.')]);
  await word('landscape.docx',[title('Landscape planning table'),p('A wide four-column table on one landscape A4 page.'),table([['Task','Owner','Status','Next step'],['Review source','Example team','Ready','Choose the DOCX'],['Convert document','Browser','Local','Download PDF'],['Check result','You','Review','Inspect all columns']],[3000,3000,3000,3000])],true);
  await deck('widescreen.pptx',true,false,image);
  await deck('standard.pptx',false,false,image);
  await deck('drawings.pptx',true,true,image);
  console.log('Created 9 original sample files in '+out);
}
main().catch(error=>{console.error(error);process.exitCode=1});
