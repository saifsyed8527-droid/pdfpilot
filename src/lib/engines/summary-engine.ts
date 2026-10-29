import { escapeMarkdown } from "./pdf-markdown-engine";
import { checkReadable, readPdfDocument, type ReadableOptions } from "./pdf-readable-engine";

const STOPWORDS = new Set("a an and are as at be been but by for from has had have he in is it its of on that the to was were will with this they you your we our their which who what when where how why can could should would may might must shall do does did done just not no nor or so than too very also into then there these those through".split(" "));
export interface SummaryPoint { text: string; pages: number[] }
export interface SummaryResult {
  originalWordCount: number; summaryWordCount: number; sentencesPicked: number; totalSentences: number;
  summary: string; bulletPoints: string[]; points: SummaryPoint[]; warnings: string[]; pagesRead: number;
}
export function summaryWords(text: string): string[] {
  return Array.from(new Intl.Segmenter(undefined,{granularity:"word"}).segment(text)).filter(item=>item.isWordLike).map(item=>item.segment);
}
export function summarySentences(text: string): string[] {
  return Array.from(new Intl.Segmenter(undefined,{granularity:"sentence"}).segment(text)).flatMap(item=>item.segment.split(/(?<=[।！？؟])\s*/u)).map(sentence=>sentence.trim()).filter(Boolean);
}
/** Retains source sentences and page references. This is local extractive
 * ranking, not an AI rewrite or an inference of the document's meaning. */
export function summarizeTextPages(pages: {number:number;text:string}[], ratio=.2): SummaryResult {
  if(!Number.isFinite(ratio)||ratio<=0||ratio>1)throw new Error("Choose a summary length between 1% and 100%.");
  const fullText=pages.map(page=>page.text).join("\n\n");
  if(fullText.length>2_000_000)throw new Error("Choose a smaller page range; summaries support two million text characters.");
  const words=summaryWords(fullText), frequencies=new Map<string,number>();
  const normalize=(value:string)=>value.normalize("NFKC").toLocaleLowerCase();
  for(const word of words){const token=normalize(word);if(!STOPWORDS.has(token))frequencies.set(token,(frequencies.get(token)??0)+1);}
  const candidates:{text:string;pages:number[];score:number;index:number}[]=[], seen=new Map<string,number>();let totalSentences=0;
  for(const page of pages)for(const text of summarySentences(page.text)){
    if(!/[\p{L}\p{N}]/u.test(text))continue;totalSentences++;
    const key=normalize(text).replace(/\s+/g," "),duplicate=seen.get(key);
    if(duplicate!==undefined){if(!candidates[duplicate].pages.includes(page.number))candidates[duplicate].pages.push(page.number);continue;}
    const tokens=summaryWords(text).map(normalize).filter(word=>!STOPWORDS.has(word));
    const score=tokens.reduce((sum,word)=>sum+Math.log(1+(frequencies.get(word)??0)),0)/Math.sqrt(Math.max(1,tokens.length));
    seen.set(key,candidates.length);candidates.push({text,pages:[page.number],score,index:candidates.length});
    if(candidates.length>20_000)throw new Error("Choose a smaller page range; this document has too many sentences to summarize at once.");
  }
  if(!candidates.length)throw new Error("No text could be summarized. Enable English OCR for scanned pages, or choose a PDF with selectable text.");
  const count=Math.max(1,Math.round(candidates.length*ratio));
  const picked=[...candidates].sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,count).sort((a,b)=>a.index-b.index);
  const summary=picked.map(point=>point.text).join(" ");
  return{summary,bulletPoints:picked.map(point=>point.text),points:picked.map(({text,pages})=>({text,pages})),originalWordCount:words.length,summaryWordCount:summaryWords(summary).length,sentencesPicked:picked.length,totalSentences,warnings:[],pagesRead:pages.length};
}
export async function summarizePdf(file: Blob, targetRatio=.2, options: ReadableOptions={}): Promise<SummaryResult> {
  const doc=await readPdfDocument(file,options);checkReadable(options);
  const result=summarizeTextPages(doc.pages.map(page=>({number:page.number,text:[page.lines.map(line=>line.text).join(" "),...page.fields].filter(Boolean).join("\n")})),targetRatio);
  checkReadable(options);options.onProgress?.(100);return{...result,warnings:doc.warnings};
}
export function summaryReport(result: SummaryResult, markdown=false): string {
  const title=markdown?"# PDF summary":"PDF summary";
  return `${title}\n\nExtractive summary: selected source sentences, without rewriting. Repeated sentences are kept once. Check the source pages for context.\n\nPages read: ${result.pagesRead}\nOriginal words: ${result.originalWordCount}\nSummary words: ${result.summaryWordCount}\nSentences: ${result.sentencesPicked} / ${result.totalSentences}\n\n${result.points.map(point=>`- ${markdown?escapeMarkdown(point.text):point.text} [Page${point.pages.length===1?"":"s"} ${point.pages.join(", ")}]`).join("\n\n")}${result.warnings.length?`\n\nConversion notes\n${result.warnings.map(note=>`- ${note}`).join("\n")}`:""}\n`;
}
