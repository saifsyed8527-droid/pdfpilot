"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Layers, Download, X, ShieldCheck, AlertCircle, List, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { PdfAddButton, PdfToolLanding, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";
import { flattenPdfSafely, type FlattenResult } from "@/lib/engines/pdf-flatten-engine";
import { renderFirstPageThumbnailWithInfo } from "@/lib/engines/pdf-render-engine";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize } from "@/lib/utils";
import { trackToolConversionCompleted, trackToolConversionFailed } from "@/lib/analytics/events";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

type Entry = { id: string; file: File; result?: FlattenResult; error?: string };
const filename = (entry: Entry) => entry.file.name.replace(/\.pdf$/i, "") + "_flattened.pdf";

function FilePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    renderFirstPageThumbnailWithInfo(file).then(result => { if (active) setPreview(result.thumbnail); }).catch(() => {});
    return () => { active = false; };
  }, [file]);
  return <div className="flex h-48 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-950">
    {preview
      // eslint-disable-next-line @next/next/no-img-element -- browser-local PDF thumbnail
      ? <img src={preview} alt="First page preview" className="h-full w-full object-contain" />
      : <FileText className="h-12 w-12 text-slate-400" aria-hidden />}
  </div>;
}

export function FlattenPdfClient({ faqs, related }: { faqs: FaqInput[]; related: ResolvedEntity[] }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [zipBusy, setZipBusy] = useState(false);
  const [listView, setListView] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);

  const chooseFiles = (files: File[]) => {
    if (processing) return;
    const valid = files.filter(file => (/\.pdf$/i.test(file.name) || file.type === "application/pdf") && file.size <= 100 * 1024 * 1024);
    if (valid.length !== files.length) toast.error("Choose PDF files up to 100MB each.");
    if (entries.length + valid.length > 20 || [...entries.map(e => e.file), ...valid].reduce((n, f) => n + f.size, 0) > 200 * 1024 * 1024) {
      toast.error("Choose up to 20 PDFs, with a combined size of 200MB or less."); return;
    }
    setEntries(previous => [...previous, ...valid.map(file => ({ id: crypto.randomUUID(), file }))]);
  };
  const reset = () => { generation.current += 1; setEntries([]); setProgress(0); setProcessing(false); };
  const cancel = () => { generation.current += 1; setProcessing(false); };
  const flatten = async () => {
    if (processing) return;
    const token = ++generation.current;
    const targets = entries.filter(entry => !entry.result);
    setProcessing(true); setProgress(0);
    for (let index = 0; index < targets.length; index += 1) {
      const entry = targets[index];
      if (token !== generation.current) return;
      setEntries(previous => previous.map(item => item.id === entry.id ? { ...item, error: undefined } : item));
      try {
        const result = await flattenPdfSafely(entry.file);
        if (token !== generation.current) return;
        setEntries(previous => previous.map(item => item.id === entry.id ? { ...item, result } : item));
        trackToolConversionCompleted("flatten-pdf");
      } catch (error) {
        if (token !== generation.current) return;
        const message = error instanceof Error ? error.message : "This PDF could not be processed.";
        setEntries(previous => previous.map(item => item.id === entry.id ? { ...item, error: message } : item));
        trackToolConversionFailed("flatten-pdf", message);
      }
      setProgress(Math.round(((index + 1) / targets.length) * 100));
    }
    if (token === generation.current) setProcessing(false);
  };
  const ready = entries.filter(entry => entry.result);
  const downloadZip = async () => {
    if (zipBusy) return;
    setZipBusy(true);
    try {
      const { zip } = await import("fflate");
      const files: Record<string, Uint8Array> = Object.create(null);
      // Stable numeric prefixes keep equal input names from overwriting files.
      for (const [index, entry] of ready.entries()) files[(index + 1) + "_" + filename(entry).replace(/[\\/]/g, "_")] = new Uint8Array(await entry.result!.blob.arrayBuffer());
      const bytes = await new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 0 }, (error, data) => error ? reject(error) : resolve(data)));
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/zip" }), "flattened-pdfs.zip");
    } catch { toast.error("Could not prepare the ZIP. Download the PDFs individually."); }
    finally { setZipBusy(false); }
  };

  if (!entries.length) return <>
    <PdfToolLanding title="Flatten PDF" description="Keep completed form values on the page. Flatten one PDF or a batch without turning your pages into images."
      buttonLabel="Select PDF files" dropLabel="or drag and drop PDFs here" limitLabel="20 files · 100MB each · 200MB total"
      accept={{ "application/pdf": [".pdf"] }} multiple icon={Layers} iconClass="text-orange-600" iconBackgroundClass="bg-orange-100 dark:bg-orange-950/40" accent="orange" onFilesSelected={chooseFiles} />
    <section className="container mx-auto max-w-4xl space-y-5 px-4 py-10">
      <h2 className="text-2xl font-bold">Frequently asked questions</h2>
      {faqs.map(faq => <details key={faq.question} className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">{faq.question}</summary><p className="mt-3 text-muted-foreground">{faq.answer}</p></details>)}
      <ToolRelatedContent items={related} />
    </section>
  </>;

  return <div data-tool-workspace className="flex flex-1 flex-col bg-slate-50 dark:bg-slate-950">
    <PdfWorkspaceBar title="Flatten PDF" meta={entries.length + " files · " + ready.length + " ready"} actions={<><Button variant="outline" size="icon" aria-label={listView ? "Switch to grid view" : "Switch to list view"} aria-pressed={listView} onClick={() => setListView(value => !value)}>{listView ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}</Button><PdfAddButton label="Add PDF files" count={entries.length} accent="orange" disabled={processing} onClick={() => input.current?.click()} /></>} />
    <input ref={input} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={event => { chooseFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} />
    <div className="container mx-auto grid max-w-[1500px] items-start gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-label="Selected PDFs" className={listView ? "grid min-w-0 gap-3" : "grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3"}>
        {entries.map(entry => <article key={entry.id} className="relative min-w-0 rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900">
          <button type="button" aria-label={"Remove " + entry.file.name} disabled={processing} onClick={() => setEntries(items => items.filter(item => item.id !== entry.id))} className="absolute right-5 top-5 z-10 rounded-full border bg-white p-2 text-slate-700 disabled:opacity-40"><X className="h-4 w-4" /></button>
          {!listView && <FilePreview file={entry.file} />}
          <h2 className="mt-3 truncate pr-8 text-sm font-semibold" title={entry.file.name}>{entry.file.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{formatFileSize(entry.file.size)}</p>
          {entry.error && <p role="alert" className="mt-3 text-sm text-red-600">{entry.error}</p>}
          {entry.result && <div className="mt-3 space-y-3">
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{entry.result.unchanged ? "No form fields — original returned unchanged." : entry.result.fieldCount + " fields flattened · " + entry.result.pageCount + " pages"}</p>
            <Button variant="outline" className="w-full" onClick={() => downloadBlob(entry.result!.blob, filename(entry))}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
          </div>}
        </article>)}
      </section>
      <aside className="space-y-5 rounded-3xl border bg-white p-6 dark:bg-slate-900">
        <div><h2 className="text-xl font-bold">Lock in form values</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Fillable fields become ordinary page content. Existing text and graphics stay sharp.</p></div>
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><ShieldCheck className="mb-2 h-5 w-5" />Files are processed on your device. Your originals are never overwritten.</div>
        <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200"><AlertCircle className="mb-2 h-5 w-5" />Flattening is not encryption or redaction. A PDF editor can still change page content. Comments, layers and digital signatures are not flattened; XFA and signature-field PDFs are rejected.</div>
        {processing ? <div className="space-y-3"><Progress value={progress} aria-label="Flattening progress" /><p role="status" className="text-sm">Processing PDFs… {progress}%</p><Button variant="outline" onClick={cancel} className="w-full">Cancel remaining files</Button></div>
          : ready.length !== entries.length && <Button size="lg" className="min-h-14 w-full" onClick={flatten}>Flatten PDF{entries.length > 1 ? "s" : ""}</Button>}
        {ready.length > 1 && <Button size="lg" className="w-full" disabled={zipBusy || processing} onClick={downloadZip}>{zipBusy ? "Preparing ZIP…" : "Download all as ZIP"}</Button>}
        <Button variant="ghost" disabled={processing} className="w-full" onClick={reset}>Start over</Button>
      </aside>
    </div>
  </div>;
}
