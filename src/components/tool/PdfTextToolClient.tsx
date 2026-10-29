"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Copy, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileToolLayout } from "./FileToolLayout";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { pdfToMarkdown } from "@/lib/engines/pdf-markdown-engine";
import { summarizePdf, summaryReport, type SummaryResult } from "@/lib/engines/summary-engine";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

type Result = { blob: Blob; text: string; extension: string; pages: number; warnings: string[]; summary?: SummaryResult };
export function PdfTextToolClient({mode,faqs=[],related=[]}:{mode:"markdown"|"summary";faqs?:FaqInput[];related?:ResolvedEntity[]}) {
  const [file,setFile]=useState<File|null>(null),[result,setResult]=useState<Result|null>(null),[loading,setLoading]=useState(false);
  const selection=useRef(0);
  const [pendingFile,setPendingFile]=useState<File|null>(null);
  const [pages,setPages]=useState(""),[ocr,setOcr]=useState(false),[images,setImages]=useState(false);
  const [headings,setHeadings]=useState(true),[tables,setTables]=useState(true),[links,setLinks]=useState(true),[markers,setMarkers]=useState(true);
  const [length,setLength]=useState(.2),[format,setFormat]=useState<"txt"|"md"|"pdf">("txt");
  const [error,setError]=useState(""),[copied,setCopied]=useState(false);
  const {processing,progress,run,cancel}=useProcessingTask(),controller=useRef<AbortController|null>(null);
  const slug=mode==="markdown"?"pdf-to-markdown":"summary-generator";
  useEffect(()=>()=>{controller.current?.abort();selection.current++;cancel();},[cancel]);
  const stop=()=>{controller.current?.abort();selection.current++;setLoading(false);setPendingFile(null);cancel();};
  const reset=()=>{stop();setFile(null);setResult(null);setError("");setCopied(false);};
  const select=async(files:File[])=>{if(!files[0])return;stop();const id=++selection.current;setLoading(true);setPendingFile(files[0]);setResult(null);setError("");setCopied(false);
    try{const source=files[0],bytes=await source.arrayBuffer();if(id!==selection.current)return;setFile(new File([bytes],source.name,{type:source.type,lastModified:source.lastModified}));}
    catch{if(id===selection.current){const message="This file could not be read. Select it again and try once more.";setError(message);toast.error(message);}}
    finally{if(id===selection.current){setLoading(false);setPendingFile(null);}}
  };
  const process=()=>{if(!file)return;controller.current?.abort();const current=new AbortController();controller.current=current;setError("");setResult(null);setCopied(false);
    void run(async(setProgress,isCancelled)=>{
      const options={pages,ocrScans:ocr,signal:current.signal,isCancelled,onProgress:(percent:number)=>setProgress(percent*.85)};
      let prepared:Result;
      if(mode==="markdown"){
        const converted=await pdfToMarkdown(file,{...options,headings,tables,links,pageMarkers:markers,includePageImages:images});
        prepared={blob:converted.blob,text:converted.markdown,extension:converted.extension,pages:converted.pages,warnings:converted.warnings};
      }else{
        const summary=await summarizePdf(file,length,options);
        const text=summaryReport(summary,format!=="txt");
        let blob:Blob;
        if(format==="pdf"){
          const {markdownToPdf}=await import("@/lib/engines/markdown-pdf-engine");
          blob=await markdownToPdf(summaryReport(summary,true),{isCancelled,onProgress:p=>setProgress(85+p*.15)});
        }else blob=new Blob([text],{type:format==="md"?"text/markdown;charset=utf-8":"text/plain;charset=utf-8"});
        prepared={blob,text,extension:format,pages:summary.pagesRead,warnings:summary.warnings,summary};
      }
      if(isCancelled()||current.signal.aborted)return;setProgress(100);setResult(prepared);
    },{toolName:slug,successMessage:mode==="markdown"?"Markdown is ready":"Summary is ready",errorTitle:"Could not process this PDF",onError:e=>{const message=e instanceof Error?e.message:"Choose a valid PDF and try again.";setError(message);return message;}});
  };
  const download=()=>{if(result)downloadBlob(result.blob,`${file?.name.replace(/\.pdf$/i,"")||"document"}${mode==="summary"?"-summary":""}.${result.extension}`);};
  const copy=async()=>{if(!result)return;try{await navigator.clipboard.writeText(result.text);setCopied(true);}catch{toast.error("Copy was unavailable. Select the text below or download the file.");}};
  const toggle=(label:string,checked:boolean,set:(value:boolean)=>void)=><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checked} onChange={event=>set(event.target.checked)} className="mt-1"/>{label}</label>;
  return <FileToolLayout toolSlug={slug} files={[loading?pendingFile:file]} accept={{"application/pdf":[".pdf"]}} onFilesSelected={select} result={result} processing={processing||loading} progress={loading?undefined:progress} onCancel={stop} onReset={reset} onDownload={download} faqs={faqs} related={related}>
    {!result&&<>
      <p className="text-sm leading-6 text-muted-foreground">{mode==="summary"?"Keep selected sentences from your PDF, with source page references. This is a free, local extractive summary; it does not rewrite or interpret your document with AI.":"Convert selectable text into Markdown. Headings, lists, safe links and simple aligned tables are detected locally. Complex columns and table layouts may need editing."}</p>
      <label className="block space-y-1 text-sm font-medium">Pages<input aria-label="Pages" value={pages} onChange={e=>setPages(e.target.value)} placeholder="All pages, or 1-3, 5" className="h-11 w-full rounded-xl border bg-background px-3"/></label>
      {toggle("Use English OCR on pages without selectable text",ocr,setOcr)}
      <p className="text-xs leading-5 text-muted-foreground">OCR runs on your device. Check its output against the PDF; it can miss text in scans, and does not recognize other languages. Pages with native text are not OCR-scanned.</p>
      {mode==="markdown"?<div className="space-y-3">{toggle("Detect headings",headings,setHeadings)}{toggle("Detect simple tables",tables,setTables)}{toggle("Keep links",links,setLinks)}{toggle("Include page markers",markers,setMarkers)}{toggle("Include whole-page images (ZIP download)",images,setImages)}<p className="text-xs leading-5 text-muted-foreground">Images preserve the appearance of each selected page; individual figures are not extracted. ZIP includes document.md and a pages folder.</p></div>:<>
        <fieldset><legend className="mb-2 text-sm font-medium">Summary length</legend><div className="grid grid-cols-3 gap-2">{[[.1,"Short"],[.2,"Medium"],[.35,"Long"]].map(([ratio,label])=><Button key={label} variant={length===ratio?"default":"outline"} aria-pressed={length===ratio} onClick={()=>setLength(Number(ratio))}>{label}</Button>)}</div><p className="mt-2 text-xs text-muted-foreground">About {Math.round(length*100)}% of distinct source sentences. Repeated sentences are included once.</p></fieldset>
        <label className="block space-y-1 text-sm font-medium">Download format<select aria-label="Download format" value={format} onChange={e=>setFormat(e.target.value as typeof format)} className="h-11 w-full rounded-xl border bg-background px-3"><option value="txt">Text (.txt)</option><option value="md">Markdown (.md)</option><option value="pdf">PDF (.pdf)</option></select></label>
      </>}
      <p className="text-xs text-muted-foreground">Up to 200 selected pages and two million text characters. Files stay on your device. Font encodings and complex reading order can affect extracted text; review it against the original.</p>
      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <Button size="lg" className="w-full" disabled={!file||processing} onClick={process}>{mode==="markdown"?"Convert to Markdown":"Generate summary"}</Button>
    </>}
    {result&&<>
      <div className="space-y-2 text-center"><h2 className="text-2xl font-bold">{mode==="markdown"?"Your Markdown is ready":"Your summary is ready"}</h2><p className="text-sm text-muted-foreground">{result.pages} {result.pages===1?"page":"pages"} processed · {result.extension.toUpperCase()} download</p></div>
      {result.summary&&<><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Original words",result.summary.originalWordCount],["Summary words",result.summary.summaryWordCount],["Sentences kept",result.summary.sentencesPicked],["Source sentences",result.summary.totalSentences]].map(([label,value])=><div key={label} className="rounded-xl bg-muted p-3 text-center"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{Number(value).toLocaleString()}</p></div>)}</div><ul className="space-y-4">{result.summary.points.map((point,i)=><li key={i} className="rounded-xl border p-4 text-sm leading-6"><p dir="auto">{point.text}</p><p className="mt-2 text-xs font-medium text-orange-700 dark:text-orange-400">Source page{point.pages.length===1?"":"s"} {point.pages.join(", ")}</p></li>)}</ul></>}
      {result.warnings.length>0&&<details className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><summary className="cursor-pointer text-sm font-semibold">Review {result.warnings.length} conversion {result.warnings.length===1?"note":"notes"}</summary><ul className="mt-3 list-disc space-y-2 ps-5 text-sm">{result.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></details>}
      <div className="flex flex-wrap justify-center gap-3"><Button onClick={download}><Download className="me-2 h-4 w-4"/>Download {result.extension.toUpperCase()}</Button><Button variant="outline" onClick={copy}>{copied?<Check className="me-2 h-4 w-4"/>:<Copy className="me-2 h-4 w-4"/>}{copied?"Copied":"Copy text"}</Button><Button variant="outline" onClick={()=>{setResult(null);setCopied(false);}}><ArrowLeft className="me-2 h-4 w-4"/>Adjust options</Button><Button variant="outline" onClick={reset}>Start over</Button></div>
      <label className="block space-y-2 text-sm font-medium">{mode==="markdown"?"Markdown source":"Full report"}<textarea aria-label={mode==="markdown"?"Markdown source":"Full report"} readOnly value={result.text} dir="auto" className="h-80 w-full min-w-0 resize-y rounded-xl border bg-background p-4 font-mono text-sm font-normal"/></label>
      {mode==="markdown"&&<p className="text-xs text-muted-foreground">Review reading order, headings and table cells against your original PDF. Detected table rows use the first row as the header. This is a structured text extraction, not an AI reconstruction.</p>}
    </>}
  </FileToolLayout>;
}
