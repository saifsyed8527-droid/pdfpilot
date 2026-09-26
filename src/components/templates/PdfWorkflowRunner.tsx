"use client";
import { useEffect, useRef, useState } from "react";
import type { PdfWorkflow } from "@/lib/content/pdf-workflows";
import { runPdfWorkflow, type WorkflowResult } from "@/lib/engines/pdf-workflow-engine";
import { downloadBlob } from "@/lib/download-file";
import { trackPseoAction } from "@/lib/analytics/events";
import { formatFileSize } from "@/lib/utils";

export function PdfWorkflowRunner({ workflow }: { workflow: PdfWorkflow }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  const [range, setRange] = useState("1"), [watermark, setWatermark] = useState("DRAFT"), [firstNumber, setFirstNumber] = useState(1);
  const [allowRasterCompression, setAllow] = useState(false);
  const [progress, setProgress] = useState({ value: 0, label: "" });
  const [error, setError] = useState("");
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const cancelled = useRef(false), mounted = useRef(true), request = useRef<AbortController | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancelled.current = true; request.current?.abort(); }; }, []);
  const compress = workflow.kind.endsWith("compress");
  const locked = busy || loading;
  const clearResult = () => { setResult(null); setError(""); };
  const sample = async () => {
    setLoading(true); clearResult(); request.current = new AbortController();
    try {
      const samples = await Promise.all(workflow.samples.map(async name => {
        const response = await fetch(`/template-samples/${name}`, { signal: request.current!.signal });
        if (!response.ok) throw new Error("The sample could not be loaded. Try again or choose your own files.");
        return new File([await response.blob()], name, { type: workflow.input === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      }));
      if (mounted.current) setFiles(samples);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "The samples could not be loaded."); }
    finally { if (mounted.current) setLoading(false); }
  };
  const run = async () => {
    cancelled.current = false; setBusy(true); clearResult(); setProgress({ value: 0, label: "Checking files…" });
    trackPseoAction("tool_chain_started", workflow.slug, "workflow", workflow.kind);
    try {
      const output = await runPdfWorkflow(workflow, files, { range, watermark, firstNumber, allowRasterCompression }, (value, label) => { if (mounted.current && !cancelled.current) setProgress({ value, label }); }, () => cancelled.current);
      if (mounted.current && !cancelled.current) { setResult(output); trackPseoAction("tool_chain_completed", workflow.slug, "workflow", workflow.kind); }
    } catch (e) {
      if (mounted.current) { setError(cancelled.current ? "Workflow cancelled. Your files are ready if you want to try again." : e instanceof Error ? e.message : "This workflow could not be completed. Try a smaller supported file."); trackPseoAction(cancelled.current ? "tool_chain_cancelled" : "tool_chain_failed", workflow.slug, "workflow", workflow.kind); }
    } finally { if (mounted.current) setBusy(false); }
  };
  const move = (index: number, delta: number) => { clearResult(); setFiles(current => { const next = [...current]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; }); };
  return <section id="runner" className="scroll-mt-24 rounded-2xl border bg-card p-5 text-card-foreground md:p-8" data-clarity-mask="True">
    <h2 className="text-2xl font-semibold">Run this workflow</h2><p className="mt-2 text-sm text-muted-foreground">{workflow.minFiles === 1 ? "One" : "2–20"} {workflow.input.toUpperCase()} {workflow.minFiles === 1 ? "file" : "files"} · up to 50 MB each, 100 MB total · up to 300 pages. Files stay on your device.</p>
    <fieldset disabled={locked} className="mt-5 min-w-0 space-y-5"><legend className="sr-only">Workflow files and settings</legend><div className="flex flex-wrap gap-3"><label className="cursor-pointer rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Choose {workflow.input.toUpperCase()} files<input className="sr-only" type="file" aria-label="Choose workflow files" accept={`.${workflow.input}`} multiple={workflow.minFiles > 1} onChange={event => { const chosen = Array.from(event.target.files ?? []); if (chosen.length) { setFiles(current => workflow.minFiles === 1 ? chosen.slice(0, 1) : [...current, ...chosen]); clearResult(); } event.target.value = ""; }} /></label><button type="button" onClick={() => void sample()} className="rounded-xl border px-5 py-3 font-semibold hover:bg-muted">{loading ? "Loading samples…" : "Try sample files"}</button></div>
      {files.length > 0 && <ol className="space-y-2" aria-label="Selected files">{files.map((file, i) => <li key={`${file.name}-${i}`} className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border p-3"><span className="text-xs text-muted-foreground">{i + 1}</span><span className="min-w-0 flex-1 break-all text-sm">{file.name} <span className="text-muted-foreground">({formatFileSize(file.size)})</span></span><div className="flex gap-2">{workflow.minFiles > 1 && <><button type="button" disabled={i === 0} aria-label={`Move file ${i + 1} up`} onClick={() => move(i, -1)} className="rounded border px-3 py-1 disabled:opacity-30">↑</button><button type="button" disabled={i === files.length - 1} aria-label={`Move file ${i + 1} down`} onClick={() => move(i, 1)} className="rounded border px-3 py-1 disabled:opacity-30">↓</button></>}<button type="button" aria-label={`Remove file ${i + 1}`} onClick={() => { setFiles(current => current.filter((_, index) => index !== i)); clearResult(); }} className="rounded border px-3 py-1 text-sm">Remove</button></div></li>)}</ol>}
      {workflow.kind === "extract-compress" && <label className="block text-sm font-medium">Pages to extract<input value={range} onChange={e => { setRange(e.target.value); clearResult(); }} className="mt-2 block w-full max-w-sm rounded-lg border bg-background px-3 py-2" placeholder="1, 3-5" /><span className="mt-2 block text-xs text-muted-foreground">Use page numbers starting at 1, for example 1, 3-5.</span></label>}
      {workflow.kind === "merge-number" && <label className="block text-sm font-medium">Starting page number<input type="number" min={1} max={9999} value={firstNumber} onChange={e => { setFirstNumber(Number(e.target.value)); clearResult(); }} className="mt-2 block w-full max-w-sm rounded-lg border bg-background px-3 py-2" /></label>}
      {workflow.kind === "merge-watermark" && <label className="block text-sm font-medium">Watermark text<input value={watermark} maxLength={40} onChange={e => { setWatermark(e.target.value); clearResult(); }} className="mt-2 block w-full max-w-sm rounded-lg border bg-background px-3 py-2" /></label>}
      {compress && <label className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm"><input type="checkbox" checked={allowRasterCompression} onChange={e => { setAllow(e.target.checked); clearResult(); }} className="mt-1 h-4 w-4 shrink-0" /><span>I allow compression to create image-based pages. Searchable text, links and form fields may be lost. If the compressed file is larger, keep the PDF from the first step.</span></label>}
    </fieldset>
    <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={locked || !files.length || (compress && !allowRasterCompression)} onClick={() => void run()} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Working…" : "Run workflow"}</button>{busy && <button type="button" onClick={() => { cancelled.current = true; setProgress(current => ({ ...current, label: "Cancelling…" })); }} className="rounded-xl border px-5 py-3">Cancel</button>}</div>
    {busy && <div className="mt-5" role="status"><p className="text-sm">{progress.label}</p><progress max={100} value={progress.value} className="mt-2 w-full" aria-label="Workflow progress" /></div>}
    {error && <p role="alert" className="mt-5 rounded-xl border border-destructive/40 p-4 text-sm text-destructive">{error}</p>}
    {result && <div className="mt-6 rounded-xl border bg-muted/30 p-5" role="status"><h3 className="font-semibold">Your PDF is ready</h3><p className="mt-2 text-sm">{result.pages} pages · {formatFileSize(result.afterBytes)}</p>{compress && <p className="mt-2 text-sm text-muted-foreground">{result.keptOriginal ? "Compression did not make this file smaller, so the PDF from the first step was kept." : `${formatFileSize(result.beforeBytes)} before compression → ${formatFileSize(result.afterBytes)} after compression.`}</p>}<button type="button" onClick={() => { downloadBlob(result.blob, `${workflow.slug}.pdf`); trackPseoAction("tool_chain_downloaded", workflow.slug, "workflow", workflow.kind); }} className="mt-4 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Download PDF</button><p className="mt-3 text-xs text-muted-foreground">Open the download and check the pages before sharing.</p></div>}
  </section>;
}
