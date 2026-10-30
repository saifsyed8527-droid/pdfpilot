"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { FileToolLayout } from "@/components/tool/FileToolLayout";
import { SourceFilePreview } from "@/components/tool/SourceFilePreview";
import { Button } from "@/components/ui/button";
import { createFlattenZip, flattenedFilename, flattenPdfSafely, type FlattenResult } from "@/lib/engines/pdf-flatten-engine";
import { renderFirstPageThumbnailWithInfo } from "@/lib/engines/pdf-render-engine";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { formatFileSize } from "@/lib/utils";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

type Entry = { id: string; file: File; result?: FlattenResult; error?: string };
interface Result { blob: Blob; name: string; entries: Entry[]; unfinished: number }
function FilePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { let active = true; renderFirstPageThumbnailWithInfo(file).then(result => { if (active) setPreview(result.thumbnail); }).catch(() => {}); return () => { active = false; }; }, [file]);
  return <div className="flex h-40 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-950">{preview
    // eslint-disable-next-line @next/next/no-img-element -- local PDF thumbnail
    ? <img src={preview} alt="First page preview" className="h-full w-full object-contain" /> : <FileText className="h-12 w-12 text-slate-400" aria-hidden />}</div>;
}
function status(entry: Entry) { return entry.result ? entry.result.unchanged ? "No fields — original returned unchanged" : `${entry.result.fieldCount} field${entry.result.fieldCount === 1 ? "" : "s"} flattened · ${entry.result.pageCount} page${entry.result.pageCount === 1 ? "" : "s"}` : entry.error ? "Needs attention" : "Ready to flatten"; }
export function FlattenPdfClient({ faqs, related }: { faqs: FaqInput[]; related: ResolvedEntity[] }) {
  const [entries, setEntries] = useState<Entry[]>([]), [selected, setSelected] = useState(0), [view, setView] = useState<"preview" | "grid" | "list">("preview");
  const [result, setResult] = useState<Result | null>(null), [loading, setLoading] = useState(false), [pending, setPending] = useState<File | null>(null), [error, setError] = useState("");
  const generation = useRef(0), controller = useRef<AbortController | null>(null), { processing, progress, run, cancel } = useProcessingTask();
  const stop = () => { generation.current++; controller.current?.abort(); cancel(); setLoading(false); setPending(null); };
  useEffect(() => () => { generation.current++; controller.current?.abort(); cancel(); }, [cancel]);
  const reset = () => { stop(); setEntries([]); setSelected(0); setResult(null); setError(""); setView("preview"); };
  const choose = async (files: File[]) => {
    if (!files.length) return; stop(); const id = ++generation.current; setLoading(true); setPending(files[0]); setError("");
    try {
      if (files.some(f => (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") || f.size > 100 * 1024 * 1024)) throw new Error("Choose PDF files up to 100MB each.");
      if (entries.length + files.length > 20 || [...entries.map(e => e.file), ...files].reduce((n, f) => n + f.size, 0) > 200 * 1024 * 1024) throw new Error("Choose up to 20 PDFs and 200MB combined.");
      const added: Entry[] = []; for (const f of files) { const stable = new File([await f.arrayBuffer()], f.name, { type: "application/pdf" }); if (id !== generation.current) return; added.push({ id: crypto.randomUUID(), file: stable }); }
      if (id === generation.current) { setEntries([...entries, ...added]); setSelected(entries.length); setResult(null); }
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : "Choose readable PDFs."); }
    finally { if (id === generation.current) { setLoading(false); setPending(null); } }
  };
  const pack = async (current: Entry[], signal: AbortSignal) => {
    const ready = current.filter(e => e.result); if (!ready.length) throw new Error("There are no completed PDFs to download.");
    const blob = ready.length === 1 ? ready[0].result!.blob : await createFlattenZip(ready.map(e => ({ name: e.file.name, blob: e.result!.blob })), signal);
    return { blob, name: ready.length === 1 ? flattenedFilename(ready[0].file.name) : "flattened-pdfs.zip", entries: ready, unfinished: current.length - ready.length };
  };
  const execute = (onlyDownload = false) => {
    const abort = new AbortController(); controller.current = abort; setError("");
    void run(async (setProgress, cancelled) => {
      let current = entries;
      if (!onlyDownload) {
        const targets = current.filter(e => !e.result);
        for (const [index, entry] of targets.entries()) {
          if (cancelled()) return;
          current = current.map(e => e.id === entry.id ? { ...e, error: undefined } : e); setEntries(current);
          try {
            const output = await flattenPdfSafely(entry.file, { signal: abort.signal, onProgress: fraction => setProgress((index + fraction / 100) / targets.length * 85) }); if (cancelled()) return;
            current = current.map(e => e.id === entry.id ? { ...e, result: output } : e);
          } catch (e) { if (cancelled()) return; current = current.map(value => value.id === entry.id ? { ...value, error: e instanceof Error ? e.message : "This PDF could not be flattened." } : value); }
          setEntries(current);
        }
        const failed = current.filter(e => !e.result); if (failed.length) throw new Error(`${current.length - failed.length} ready · ${failed.length} unfinished. Review the file messages, remove unsupported files or retry. Completed files are kept.`);
      }
      setProgress(90); const ready = await pack(current, abort.signal); if (cancelled()) return; setResult(ready); setProgress(100);
    }, { toolName: "flatten-pdf", successMessage: "Your PDF download is ready", errorTitle: "Review the unfinished files", onError: e => { const message = e instanceof Error ? e.message : "Check the PDFs and retry."; setError(message); return message; } });
  };
  const selectedEntry = entries[Math.min(selected, entries.length - 1)], ready = entries.filter(e => e.result);
  const remove = (id: string) => { const index = entries.findIndex(e => e.id === id), next = entries.filter(e => e.id !== id); setEntries(next); setSelected(Math.max(0, Math.min(selected - (index < selected ? 1 : 0), next.length - 1))); setError(""); };
  const workspace = <div className="space-y-4"><div className="flex flex-wrap gap-2">{(["preview", "grid", "list"] as const).map(mode => <Button key={mode} variant={view === mode ? "default" : "outline"} aria-pressed={view === mode} onClick={() => setView(mode)}>{mode === "preview" ? "Page preview" : mode === "grid" ? "Grid view" : "List view"}</Button>)}</div>
    {view === "preview" && selectedEntry ? <SourceFilePreview key={selectedEntry.id} file={selectedEntry.file} /> : <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>{entries.map((entry, index) => <article key={entry.id} className={`min-w-0 rounded-xl border p-3 ${index === selected ? "border-orange-500" : ""}`}>{view === "grid" && <FilePreview file={entry.file} />}<button className="mt-2 w-full break-all text-left text-sm font-semibold hover:underline" onClick={() => { setSelected(index); setView("preview"); }}>Preview {entry.file.name}</button><p className="text-xs text-muted-foreground">{formatFileSize(entry.file.size)}</p><p className="mt-2 text-sm">{status(entry)}</p>{entry.error && <p role="alert" className="mt-2 text-xs text-red-600">{entry.error}</p>}<Button variant="ghost" size="sm" onClick={() => remove(entry.id)}>Remove {entry.file.name}</Button></article>)}</div>}
  </div>;
  return <FileToolLayout toolSlug="flatten-pdf" files={loading ? [pending] : entries.map(e => e.file)} accept={{ "application/pdf": [".pdf"] }} multiple selectedFileIndex={selected} onSelectedFileChange={setSelected} onFilesSelected={choose} landingError={error} result={result} processing={processing || loading} progress={loading ? undefined : progress} onCancel={stop} onReset={reset} onDownload={() => { if (result) downloadBlob(result.blob, result.name); }} preview={workspace} faqs={faqs} related={related}>
    {result ? <div className="space-y-5"><h2 className="text-center text-2xl font-bold">{result.entries.length === 1 ? "Your PDF is ready" : "Your PDFs are ready"}</h2>{result.unfinished > 0 && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{result.unfinished} unfinished file{result.unfinished === 1 ? " is" : "s are"} not included. Return to files to review them.</p>}<ul className="space-y-3">{result.entries.map(entry => <li key={entry.id} className="space-y-2 rounded-xl border p-4"><p className="break-all font-medium">{flattenedFilename(entry.file.name)}</p><p className="text-sm">{status(entry)}</p>{!!entry.result?.annotationCount && <p className="text-xs text-muted-foreground">{entry.result.annotationCount} non-form annotations preserved.</p>}{result.entries.length > 1 && <Button variant="outline" onClick={() => downloadBlob(entry.result!.blob, flattenedFilename(entry.file.name))}>Download {entry.file.name}</Button>}</li>)}</ul><div className="flex flex-wrap justify-center gap-3"><Button onClick={() => downloadBlob(result.blob, result.name)}>Download {result.entries.length > 1 ? "ZIP" : "PDF"}</Button><Button variant="outline" onClick={() => setResult(null)}>Back to files</Button><Button variant="outline" onClick={reset}>Start over</Button></div></div>
      : <><p className="text-sm">{entries.length} selected · {ready.length} completed</p><p className="text-sm text-muted-foreground">Saved form values become ordinary page content. Original text and graphics stay sharp. Keep the editable originals.</p>
        {selectedEntry && <div className="space-y-3 rounded-xl border p-3"><p className="break-all text-sm font-medium">{selectedEntry.file.name}</p><p className="text-sm">{status(selectedEntry)}</p>{selectedEntry.error && <p role="alert" className="text-sm text-red-600">{selectedEntry.error}</p>}{selectedEntry.result && <Button variant="outline" className="w-full" onClick={() => downloadBlob(selectedEntry.result!.blob, flattenedFilename(selectedEntry.file.name))}>Download this PDF</Button>}<Button variant="ghost" className="w-full" onClick={() => remove(selectedEntry.id)}>Remove this file</Button></div>}
        {entries.some(e => e.error) && <ul className="max-h-48 space-y-2 overflow-auto rounded-xl bg-amber-50 p-3 text-xs text-amber-950">{entries.filter(e => e.error).map(e => <li key={e.id}><strong className="break-all">{e.file.name}</strong>: {e.error}</li>)}</ul>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {ready.length < entries.length && <Button size="lg" className="w-full" onClick={() => execute()}>{entries.some(e => e.error) ? "Retry unfinished PDFs" : `Flatten ${entries.length - ready.length} PDF${entries.length - ready.length === 1 ? "" : "s"}`}</Button>}
        {ready.length > 0 && <Button variant={ready.length === entries.length ? "default" : "outline"} className="w-full" onClick={() => execute(true)}>Download {ready.length} completed file{ready.length === 1 ? "" : "s"}</Button>}
        <p className="text-xs text-muted-foreground">20 PDFs · 100MB each · 200MB combined. Unsupported files stay separate so you can download the successful results.</p><p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950">Flattening is not encryption or redaction. Comments, links and layers remain. XFA, signature fields and appearances that cannot be preserved safely are rejected.</p>
      </>}
  </FileToolLayout>;
}
