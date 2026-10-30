"use client";

import { useEffect, useRef, useState } from "react";
import { FileToolLayout } from "@/components/tool/FileToolLayout";
import { SourceFilePreview } from "@/components/tool/SourceFilePreview";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { emptyMetadata, inspectPdfMetadata, metadataKeys, removePdfDocumentMetadata, savePdfMetadata, type MetadataSnapshot, type MetadataValues } from "@/lib/engines/pdf-metadata-engine";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

const labels = { title: "Title", author: "Author", subject: "Subject", keywords: "Keywords", creator: "Creator", producer: "Producer", created: "Created (UTC)", modified: "Modified (UTC)" };
interface Result { file: File; snapshot: MetadataSnapshot; removed: boolean }
export function PdfMetadataEditorClient({ faqs, related }: { faqs: FaqInput[]; related: ResolvedEntity[] }) {
  const [file, setFile] = useState<File | null>(null), [snapshot, setSnapshot] = useState<MetadataSnapshot | null>(null), [values, setValues] = useState<MetadataValues>(emptyMetadata);
  const [loading, setLoading] = useState(false), [pending, setPending] = useState<File | null>(null), [error, setError] = useState(""), [removeXmp, setRemoveXmp] = useState(false), [result, setResult] = useState<Result | null>(null);
  const generation = useRef(0), controller = useRef<AbortController | null>(null), { processing, progress, run, cancel } = useProcessingTask();
  const stop = () => { generation.current++; controller.current?.abort(); cancel(); setLoading(false); setPending(null); };
  useEffect(() => () => { generation.current++; controller.current?.abort(); cancel(); }, [cancel]);
  const reset = () => { stop(); setFile(null); setSnapshot(null); setValues(emptyMetadata); setResult(null); setRemoveXmp(false); setError(""); };
  const choose = async (files: File[]) => {
    if (!files[0]) return; stop(); const id = ++generation.current, abort = new AbortController(); controller.current = abort; setLoading(true); setPending(files[0]); setError("");
    try { if (files[0].size > 100 * 1024 * 1024) throw new Error("Choose a PDF of 100MB or smaller."); const stable = new File([await files[0].arrayBuffer()], files[0].name, { type: "application/pdf" }), details = await inspectPdfMetadata(stable, abort.signal); if (id !== generation.current) return; setFile(stable); setSnapshot(details); setValues(details.values); setResult(null); setRemoveXmp(false); }
    catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : "Choose a readable PDF."); }
    finally { if (id === generation.current) { setLoading(false); setPending(null); } }
  };
  const save = (removed: boolean) => {
    if (!file) return; const abort = new AbortController(); controller.current = abort; setError("");
    void run(async (setProgress, cancelled) => {
      setProgress(15); const blob = removed ? await removePdfDocumentMetadata(file, abort.signal) : await savePdfMetadata(file, values, { removeXmp, signal: abort.signal }); if (cancelled()) return;
      setProgress(85); const base = file.name.replace(/\.pdf$/i, "").replace(/[\\/\u0000-\u001f]/g, "_") || "document", output = new File([blob], `${base}-${removed ? "metadata-removed" : "metadata-edited"}.pdf`, { type: "application/pdf" });
      const saved = await inspectPdfMetadata(output, abort.signal); if (cancelled()) return; setResult({ file: output, snapshot: saved, removed }); setProgress(100);
    }, { toolName: "pdf-metadata-editor", successMessage: removed ? "Document metadata removed" : "Metadata saved", errorTitle: "Could not save metadata", onError: e => { const message = e instanceof Error ? e.message : "Check metadata values and retry."; setError(message); return message; } });
  };
  return <FileToolLayout toolSlug="pdf-metadata-editor" files={loading ? [pending] : [file]} accept={{ "application/pdf": [".pdf"] }} multiple={false} onFilesSelected={choose} landingError={error} result={result} processing={processing || loading} progress={loading ? undefined : progress} onCancel={stop} onReset={reset} onDownload={() => { if (result) downloadBlob(result.file, result.file.name); }} faqs={faqs} related={related}>
    {result ? <div className="space-y-5"><div className="text-center"><h2 className="text-2xl font-bold">{result.removed ? "Document metadata removed" : "Your updated PDF is ready"}</h2><p className="mt-2 break-all text-sm text-muted-foreground">{result.file.name} · {result.snapshot.pageCount} pages</p></div>
      <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">Verify saved metadata</summary><dl className="mt-3 space-y-2 text-sm">{metadataKeys.map(key => <div key={key}><dt className="font-medium">{labels[key]}</dt><dd className="whitespace-pre-wrap break-words text-muted-foreground">{result.snapshot.values[key] || "Not set"}</dd></div>)}</dl><p className="mt-3 text-xs">{result.snapshot.hasXmp ? "Embedded XMP present" : "No embedded document XMP"} · {result.snapshot.custom.length} custom Info fields</p></details>
      <SourceFilePreview file={result.file} /><div className="flex flex-wrap justify-center gap-3"><Button onClick={() => downloadBlob(result.file, result.file.name)}>Download PDF</Button><Button variant="outline" onClick={() => { setFile(result.file); setSnapshot(result.snapshot); setValues(result.snapshot.values); setResult(null); setRemoveXmp(false); }}>Continue editing</Button><Button variant="outline" onClick={reset}>Start over</Button></div></div>
      : snapshot && <div className="space-y-5"><p className="text-sm text-muted-foreground">{snapshot.pageCount} pages · {snapshot.hasXmp ? "Info + embedded XMP" : "PDF Info metadata"}</p>
        <div className="space-y-3">{metadataKeys.map(key => <label key={key} className="block space-y-1 text-sm font-medium">{labels[key]}<input aria-label={labels[key]} type={key === "created" || key === "modified" ? "datetime-local" : "text"} step={1} maxLength={8000} value={values[key]} onChange={e => setValues({ ...values, [key]: e.target.value })} onInput={e => setValues({ ...values, [key]: e.currentTarget.value })} className="h-11 w-full min-w-0 rounded-xl border bg-background px-3" /></label>)}</div>
        <p className="text-xs text-muted-foreground">Dates use UTC. Blank fields are removed. Existing dates are preserved unless you change them.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setValues({ ...values, modified: new Date().toISOString().slice(0,19) })}>Modified: now</Button><Button variant="outline" onClick={() => { setValues(snapshot.values); setError(""); }}>Restore loaded values</Button></div>
        {snapshot.custom.length > 0 && <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-medium">{snapshot.custom.length} custom Info fields preserved</summary><dl className="mt-3 space-y-2 text-xs">{snapshot.custom.map((entry, i) => <div key={i}><dt className="font-medium break-all">{entry.name}</dt><dd className="break-all whitespace-pre-wrap text-muted-foreground">{entry.value}</dd></div>)}</dl></details>}
        {snapshot.warnings.map(w => <p key={w} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{w}</p>)}
        {snapshot.hasXmp && <label className="flex items-start gap-2 text-sm"><input type="checkbox" aria-label="Remove embedded XMP on save" checked={removeXmp} onChange={e => setRemoveXmp(e.target.checked)} className="mt-1" /><span>Remove embedded XMP on save<span className="mt-1 block text-xs text-muted-foreground">Also removes document XMP custom properties and archival identifiers. Leave off to preserve them and synchronize the fields above.</span></span></label>}
        {snapshot.signed && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This PDF contains a digital signature or certification. Choose an unsigned copy to edit metadata.</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <Button size="lg" className="w-full" disabled={snapshot.signed} onClick={() => save(false)}>Save metadata</Button><Button variant="outline" className="w-full" disabled={snapshot.signed} onClick={() => save(true)}>Remove document metadata</Button>
        <p className="text-xs leading-5 text-muted-foreground">Remove document metadata clears standard/custom Info fields, dates and embedded metadata streams. It does not remove visible text, form values, comments, attachments or embedded image details. Use Redact PDF for sensitive page content.</p>
      </div>}
  </FileToolLayout>;
}
