import { checkReadable, readPdfDocument, type ReadableDocument, type ReadableLine, type ReadableOptions, type ReadableRun } from "./pdf-readable-engine";

export interface PdfMarkdownOptions extends ReadableOptions { headings?: boolean; tables?: boolean; links?: boolean; pageMarkers?: boolean }
export interface PdfMarkdownResult { markdown: string; blob: Blob; extension: "md" | "zip"; pages: number; warnings: string[] }
export function escapeMarkdown(value: string): string {
  return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/([\\`*_{}\[\]#|~])/g,"\\$1");
}
function formattedRuns(runs: ReadableRun[], links: boolean): string {
  let output = "";
  for (let i=0;i<runs.length;i++) {
    const run=runs[i], previous=runs[i-1];
    const spaced = previous && !/\s$/.test(previous.text) && !/^\s/.test(run.text) && (run.dir === "rtl" || run.x-previous.x-previous.width > run.height*.12);
    if(spaced) output += " ";
    output += links && run.url ? `[${escapeMarkdown(run.text)}](<${run.url}>)` : escapeMarkdown(run.text);
  }
  return output.trim();
}
function cells(line: ReadableLine): ReadableRun[][] {
  const result: ReadableRun[][]=[];
  for(const run of [...line.runs].sort((a,b)=>a.x-b.x)) {
    const previous=result.at(-1)?.at(-1);
    if(!previous || run.x-previous.x-previous.width > Math.max(16,line.height*2)) result.push([run]);
    else result.at(-1)!.push(run);
  }
  return result;
}
function tableAt(lines: ReadableLine[], start: number) {
  const first=cells(lines[start]);
  if(first.length<2 || first.length>12 || first.some(cell=>cell.map(r=>r.text).join("").length>110)) return null;
  const rows=[first];
  for(let i=start+1;i<lines.length;i++) {
    const next=cells(lines[i]);
    if(lines[i].y-lines[i-1].y>Math.max(lines[i].height,lines[i-1].height)*2.8 || next.length!==first.length || next.some((cell,j)=>Math.abs(cell[0].x-first[j][0].x)>Math.max(12,lines[i].height) || cell.map(r=>r.text).join("").length>110)) break;
    rows.push(next);
  }
  return rows.length>=2 ? rows : null;
}
export function documentToMarkdown(doc: ReadableDocument, options: PdfMarkdownOptions = {}): string {
  const sizes=doc.pages.flatMap(page=>page.lines.map(line=>({size:line.height,weight:Math.min(line.text.length,100)}))).sort((a,b)=>a.size-b.size);
  const weight=sizes.reduce((n,item)=>n+item.weight,0);let sum=0, body=12;
  for(const item of sizes){sum+=item.weight;if(sum>=weight/2){body=item.size;break;}}
  const output:string[]=[];
  for(const page of doc.pages) {
    if(options.pageMarkers!==false) output.push(`<!-- Page ${page.number} -->`);
    let paragraph="";
    const flush=()=>{if(paragraph)output.push(paragraph);paragraph="";};
    for(let i=0;i<page.lines.length;i++) {
      const line=page.lines[i], previous=page.lines[i-1];
      const table=options.tables!==false ? tableAt(page.lines,i):null;
      if(table){flush();output.push(table.map((row,n)=>`| ${row.map(cell=>formattedRuns(cell,options.links!==false)).join(" | ")} |`+(n===0?`\n| ${row.map(()=>"---").join(" | ")} |`:"")).join("\n"));i+=table.length-1;continue;}
      const list=line.text.match(/^\s*(?:([•●▪◦*-])\s+|(\d+)[.)]\s+)(.+)$/u);
      if(list){flush();const marker=list[2]?`${list[2]}. `:"- ";output.push(marker+escapeMarkdown(list[3]));continue;}
      const heading=options.headings!==false && !page.ocr && line.height>=body*1.25 && line.text.length<200;
      const value=formattedRuns(line.runs,options.links!==false) || escapeMarkdown(line.text);
      if(heading){flush();output.push(`${line.height>=body*1.6?"#":"##"} ${value}`);continue;}
      if(previous && (line.y-previous.y>Math.max(previous.height,line.height)*1.8 || Math.abs(line.x-previous.x)>30))flush();
      paragraph+=(paragraph?" ":"")+value;
    }
    flush();
    if(page.fields.length)output.push(`**Form values**\n\n${page.fields.map(value=>`- ${escapeMarkdown(value)}`).join("\n")}`);
    if(!page.lines.length&&!page.fields.length)output.push(`*No text extracted on page ${page.number}. See conversion notes.*`);
    if(page.image)output.push(`![PDF page ${page.number}](pages/page-${String(page.number).padStart(4,"0")}.png)`);
  }
  if(doc.warnings.length)output.push(`## Conversion notes\n\n${doc.warnings.map(note=>`- ${escapeMarkdown(note)}`).join("\n")}`);
  return output.join("\n\n").trim()+"\n";
}
export async function pdfToMarkdown(file: Blob, options: PdfMarkdownOptions = {}): Promise<PdfMarkdownResult> {
  const doc=await readPdfDocument(file,options);checkReadable(options);
  if(!doc.pages.some(page=>page.lines.length||page.fields.length) && !options.includePageImages) throw new Error("No text was extracted. Enable English OCR for scans, or include page images to preserve scanned pages.");
  const markdown=documentToMarkdown(doc,options);
  let blob:Blob,extension:"md"|"zip"="md";
  if(options.includePageImages){
    const {zipSync,strToU8}=await import("fflate");checkReadable(options);
    const entries:Record<string,Uint8Array>={"document.md":strToU8(markdown),"README.txt":strToU8("PDF Pilot conversion\n\nOpen document.md beside the pages folder. Images show whole source pages, not individually extracted figures. Headings, simple tables and reading order are inferred. Review the Markdown against the source. English OCR is used only when selected and no native text is found. No files are uploaded.\n")};
    for(const page of doc.pages)if(page.image)entries[`pages/page-${String(page.number).padStart(4,"0")}.png`]=page.image;
    const bytes=zipSync(entries,{level:1});blob=new Blob([new Uint8Array(bytes).buffer],{type:"application/zip"});extension="zip";
  }else blob=new Blob([markdown],{type:"text/markdown;charset=utf-8"});
  checkReadable(options);options.onProgress?.(100);return{markdown,blob,extension,pages:doc.pages.length,warnings:doc.warnings};
}
