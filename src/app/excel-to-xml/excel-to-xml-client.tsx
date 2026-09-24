"use client";

import { UiText } from "@/components/i18n/UiText";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { ArrowDownAZ, ArrowRight, Code2, Download, FileSpreadsheet, Link2, Loader2, RotateCcw, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PdfAddButton, PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { bundleExcelOutputs, DEFAULT_EXCEL_OPTIONS, EXCEL_FORMATS, type ExcelFormat, type ExcelInspection, type ExcelOptions, type ExcelOutput } from "@/lib/engines/excel-conversion-engine";
import { runExcelWorker } from "@/lib/engines/excel-worker-client";
import { downloadBlob } from "@/lib/download-file";
import { cn, formatFileSize } from "@/lib/utils";

const ACCEPT = { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"], "application/vnd.ms-excel": [".xls"] };
const FIELD = "w-full min-w-0 rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
type Item = { id: string; file: File; options: ExcelOptions; inspection?: ExcelInspection; error?: string; status: "reading" | "ready" | "converting" | "done" | "error"; outputs: ExcelOutput[] };
type Preview = { title: string; rows?: string[][]; text?: string };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={(event) => { event.preventDefault(); onClose(); }} aria-label={title} className="m-auto max-h-[85vh] w-[min(720px,calc(100%-2rem))] overflow-auto rounded-lg border bg-background p-5 text-foreground shadow-xl backdrop:bg-black/50">
    <div className="mb-5 flex items-start justify-between gap-4"><h2 className="min-w-0 break-words text-lg font-semibold">{title}</h2><Button size="icon" variant="ghost" onClick={onClose} aria-label="Close dialog" title="Close dialog"><X className="h-5 w-5" /></Button></div>{children}
  </dialog>;
}

export function ExcelToXmlClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [adding, setAdding] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("");
  const [result, setResult] = useState<ExcelOutput | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [importing, setImporting] = useState(false);
  const jobs = useRef(new Set<AbortController>());
  const activeRun = useRef<AbortController | null>(null);
  const addingRef = useRef(false);
  const autoDownloaded = useRef(false);
  useEffect(() => {
    const controllers = jobs.current;
    return () => { controllers.forEach((controller) => controller.abort()); };
  }, []);
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const busy = adding || processing || importing;
  const patchItem = (id: string, patch: Partial<Item>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));

  async function inspect(item: Item) {
    const controller = new AbortController(); jobs.current.add(controller);
    patchItem(item.id, { status: "reading", error: undefined, outputs: [], options: item.options });
    try {
      const inspection = await runExcelWorker("inspect", item.file, item.options, controller.signal);
      const sheets = item.options.sheets?.filter((name) => inspection.sheets.some((sheet) => sheet.name === name)) ?? inspection.sheets.map((sheet) => sheet.name);
      patchItem(item.id, { inspection, status: "ready", options: { ...item.options, sheets } });
    } catch (error) {
      if (!controller.signal.aborted) patchItem(item.id, { status: "error", inspection: undefined, error: error instanceof Error ? error.message : "Could not read this workbook." });
    } finally { jobs.current.delete(controller); }
  }

  async function addFiles(files: File[]) {
    if (addingRef.current || activeRun.current) return;
    const accepted: File[] = [];
    let size = items.reduce((sum, item) => sum + item.file.size, 0);
    for (const file of files) {
      if (!/\.(xlsx|xls)$/i.test(file.name) || !file.size || file.size > 100 * 1024 * 1024) { toast.error(`${file.name}: choose an XLSX or XLS file up to 100MB.`); continue; }
      if (items.length + accepted.length >= 20 || size + file.size > 200 * 1024 * 1024) { toast.error("A batch can contain up to 20 files and 200MB in total."); break; }
      accepted.push(file); size += file.size;
    }
    if (!accepted.length) return;
    addingRef.current = true; setAdding(true);
    const next: Item[] = accepted.map((file) => ({ id: crypto.randomUUID(), file, options: { ...DEFAULT_EXCEL_OPTIONS }, status: "reading", outputs: [] }));
    setItems((current) => [...current, ...next]); setSelectedId(next[0].id); setResult(null);
    try { for (const item of next) await inspect(item); }
    finally { addingRef.current = false; setAdding(false); }
  }

  const dropzone = useDropzone({ accept: ACCEPT, multiple: true, maxSize: 100 * 1024 * 1024, noClick: true, noKeyboard: true, disabled: busy, onDropAccepted: addFiles, onDropRejected: () => toast.error("Choose XLSX or XLS files up to 100MB each.") });

  function updateOptions(id: string, options: Partial<ExcelOptions>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, options: { ...item.options, ...options }, outputs: [], ...(item.inspection ? { status: "ready" as const, error: options.sheets?.length === 0 ? "Select at least one worksheet." : undefined } : {}) } : item));
    setResult(null);
  }

  async function applySettings(reset = false) {
    if (!selected || busy) return;
    const next = { ...selected, options: reset ? { ...DEFAULT_EXCEL_OPTIONS } : selected.options };
    setAdding(true); addingRef.current = true;
    try { await inspect(next); } finally { setAdding(false); addingRef.current = false; }
  }

  async function convertAll() {
    if (busy || activeRun.current) return;
    const candidates = items.filter((item) => item.status !== "done" && item.inspection && item.options.sheets?.length);
    if (!candidates.length && !items.some((item) => item.outputs.length)) return;
    setItems((current) => current.map((item) => item.inspection && !item.options.sheets?.length ? { ...item, status: "error", error: "Select at least one worksheet." } : item));
    const controller = new AbortController(); activeRun.current = controller; jobs.current.add(controller);
    setProcessing(true); setProgress(0);
    const outputs = items.flatMap((item) => item.status === "done" ? item.outputs : []);
    try {
      for (const [index, item] of candidates.entries()) {
        if (controller.signal.aborted) break;
        setLabel(`Converting ${index + 1} of ${candidates.length}: ${item.file.name}`);
        patchItem(item.id, { status: "converting", error: undefined });
        try {
          const converted = await runExcelWorker("convert", item.file, item.options, controller.signal, (value) => setProgress((index + value / 100) / candidates.length * 95));
          if (controller.signal.aborted) { patchItem(item.id, { status: "ready" }); break; }
          outputs.push(...converted); patchItem(item.id, { status: "done", outputs: converted });
        } catch (error) {
          if (controller.signal.aborted) { patchItem(item.id, { status: "ready" }); break; }
          patchItem(item.id, { status: "error", error: error instanceof Error ? error.message : "Conversion failed. Please try again." });
        }
      }
      if (!controller.signal.aborted && outputs.length) {
        setLabel("Preparing downloads...");
        const download = outputs.length === 1 ? outputs[0] : { name: "converted_workbooks.zip", blob: await bundleExcelOutputs(outputs) };
        if (!controller.signal.aborted) { autoDownloaded.current = false; setProgress(100); setResult(download); }
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not prepare downloads."); }
    finally { jobs.current.delete(controller); activeRun.current = null; setProcessing(false); }
  }

  async function importUrl(event: React.FormEvent) {
    event.preventDefault(); if (importing) return;
    setImporting(true); setUrlError("");
    const controller = new AbortController(); jobs.current.add(controller);
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch("/api/excel-to-xml/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }), signal: controller.signal });
      if (!response.ok) throw new Error((await response.json()).error || "Could not import the workbook.");
      const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] || "imported.xlsx";
      const file = new File([await response.blob()], name);
      setUrlOpen(false); setUrl(""); await addFiles([file]);
    } catch (error) { setUrlError(controller.signal.aborted ? "The import timed out. Try a direct download link." : error instanceof Error ? error.message : "Could not import this file."); }
    finally { clearTimeout(timeout); jobs.current.delete(controller); setImporting(false); }
  }

  const urlButton = <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setUrlError(""); setUrlOpen(true); }}><Link2 className="mr-2 h-4 w-4" />Import from URL</Button>;
  const dialogs = <>
    {urlOpen && <Modal title="Import Excel from URL" onClose={() => { if (!importing) setUrlOpen(false); }}><form onSubmit={importUrl} className="space-y-4"><label className="block text-sm font-medium">Public download URL<input className={`${FIELD} mt-2`} type="url" required value={url} onChange={(event) => setUrl(event.target.value)} disabled={importing} maxLength={2048} placeholder="https://example.com/workbook.xlsx" /></label><p className="text-xs leading-5 text-muted-foreground">Direct XLSX or XLS links, up to 4MB. PDFPilot fetches the link through its server; conversion happens on your device. Private cloud sharing pages require downloading the file first.</p>{urlError && <p role="alert" className="text-sm text-destructive">{urlError}</p>}<Button type="submit" disabled={importing}>{importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Import workbook</Button></form></Modal>}
    {preview && <Modal title={preview.title} onClose={() => setPreview(null)}>{preview.rows ? <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-xs"><tbody>{preview.rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column} className="max-w-48 border px-3 py-2"><span className="line-clamp-3 break-words">{value}</span></td>)}</tr>)}</tbody></table><p className="mt-3 text-xs text-muted-foreground">First non-empty sheet, up to 6 rows and 6 columns.</p></div> : <pre className="max-h-[55vh] overflow-auto rounded-lg bg-muted p-4 text-xs">{preview.text}</pre>}</Modal>}
  </>;

  if (result) return <>{dialogs}<PdfToolResultLayout toolSlug="excel-to-xml" showRelated={false} showTrust={false}><ResultState resultFilename={result.name} fileSize={formatFileSize(result.blob.size)} downloadLabel={result.name.endsWith(".zip") ? "Download all (ZIP)" : "Download file"} onDownload={() => downloadBlob(result.blob, result.name)} autoDownloadedRef={autoDownloaded} onStartOver={() => { setItems([]); setResult(null); }} />
    <div className="mt-6 divide-y border-y">{items.map((item) => <div key={item.id} className="py-4"><div className="flex items-start justify-between gap-3"><p className="min-w-0 break-words text-sm font-medium">{item.file.name}</p><span className={cn("shrink-0 text-xs", item.status === "done" ? "text-emerald-600" : "text-destructive")}>{item.status === "done" ? "Done" : "Not converted"}</span></div>{item.error && <p role="alert" className="mt-2 text-sm text-destructive">{item.error}</p>}{item.outputs.map((output, index) => <div key={index} className="mt-2 flex items-center justify-between gap-2"><span className="min-w-0 break-all text-xs text-muted-foreground">{output.name} · {formatFileSize(output.blob.size)}</span><div className="flex shrink-0">{/\.(xml|csv)$/.test(output.name) && <Button size="icon" variant="ghost" title="Preview output" aria-label={`Preview ${output.name}`} onClick={async () => setPreview({ title: output.name, text: await output.blob.slice(0, 100_000).text() })}><Code2 className="h-4 w-4" /></Button>}<Button size="icon" variant="ghost" title="Download file" aria-label={`Download ${output.name}`} onClick={() => downloadBlob(output.blob, output.name)}><Download className="h-4 w-4" /></Button></div></div>)}</div>)}</div>
    <Button variant="outline" className="mt-5" onClick={() => { setResult(null); setItems((current) => current.map((item) => ({ ...item, outputs: [], status: item.inspection ? "ready" : "error" }))); }}><RotateCcw className="mr-2 h-4 w-4" />Convert these files again</Button>
  </PdfToolResultLayout></>;

  if (!items.length) return <>{dialogs}<PdfToolLanding title="Excel to XML" description="Convert Excel workbooks into XML. Choose sheets, convert a batch, or export to CSV, ODS, XLS and PDF." buttonLabel="Select Excel files" dropLabel="or drag and drop XLSX or XLS files here" limitLabel="100MB per file · up to 20 files" accept={ACCEPT} multiple icon={FileSpreadsheet} iconClass="text-emerald-600" iconBackgroundClass="bg-emerald-100" accent="emerald" onFilesSelected={addFiles} /></>;

  return <>{dialogs}<div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50">
    <PdfWorkspaceBar title="Excel to XML" meta={`${items.length} file${items.length === 1 ? "" : "s"} · ${formatFileSize(items.reduce((sum, item) => sum + item.file.size, 0))}`} actions={<><Button variant="ghost" size="icon" title="Sort files A to Z" aria-label="Sort files A to Z" disabled={busy} onClick={() => setItems((current) => [...current].sort((a, b) => a.file.name.localeCompare(b.file.name)))}><ArrowDownAZ className="h-5 w-5" /></Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => setItems([])}><UiText text="Clear" /></Button></>} />
    <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_380px]">
      <section {...dropzone.getRootProps()} className={cn("min-w-0 border-b p-5 lg:min-h-[620px] lg:border-b-0 lg:border-r lg:p-8", dropzone.isDragActive && "bg-emerald-50 dark:bg-emerald-950/30")}><input {...dropzone.getInputProps()} />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold"><UiText text="Your workbooks" /></h2><div className="flex items-center gap-3">{urlButton}<PdfAddButton count={items.length} label="Add Excel files" accent="emerald" onClick={dropzone.open} disabled={busy} /></div></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className={cn("min-w-0 rounded-lg border bg-white p-4 dark:bg-slate-900", selected?.id === item.id && "ring-2 ring-emerald-500")}>
          <div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400">{item.file.name.split(".").pop()}</span><div className="flex"><Button size="icon" variant="ghost" title="File settings" aria-label={`Settings for ${item.file.name}`} disabled={busy} onClick={() => setSelectedId(item.id)}><Settings2 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title="Remove file" aria-label={`Remove ${item.file.name}`} disabled={busy} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><X className="h-4 w-4" /></Button></div></div>
          <button className="flex h-32 w-full items-center justify-center overflow-hidden rounded border bg-slate-50 text-emerald-600 dark:bg-slate-950/50" aria-label={`Preview ${item.file.name}`} title="Preview workbook" disabled={!item.inspection || busy} onClick={() => setPreview({ title: item.file.name, rows: item.inspection?.preview })}>{item.status === "reading" ? <Loader2 className="h-10 w-10 animate-spin" /> : item.inspection?.preview.length ? <table aria-hidden className="w-full table-fixed text-left text-[9px] text-slate-600 dark:text-slate-300"><tbody>{item.inspection.preview.map((row, index) => <tr key={index}>{row.slice(0, 4).map((cell, column) => <td key={column} className="truncate border px-1 py-2">{cell}</td>)}</tr>)}</tbody></table> : <FileSpreadsheet className="h-12 w-12" />}</button>
          <p title={item.file.name} className="mt-4 truncate text-sm font-semibold">{item.file.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatFileSize(item.file.size)}{item.inspection && ` · ${item.inspection.sheets.length} sheets`}</p>
          <label className="mt-4 block text-xs font-medium">Output<select aria-label={`Output for ${item.file.name}`} className={`${FIELD} mt-1`} value={item.options.format} disabled={busy} onChange={(event) => updateOptions(item.id, { format: event.target.value as ExcelFormat })}>{EXCEL_FORMATS.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}</select></label>
          <div className="mt-3 min-h-5 text-xs" aria-live="polite">{item.error ? <p role="alert" className="break-words text-destructive">{item.error}</p> : <span className="text-muted-foreground">{item.status === "reading" ? "Reading workbook..." : item.status === "converting" ? "Converting..." : item.status === "done" ? "Converted" : `${item.options.sheets?.length ?? 0} sheets selected`}</span>}</div>
        </article>)}</div>
      </section>
      <aside className="min-w-0 bg-white p-5 dark:bg-slate-900 lg:p-6"><div className="flex items-center gap-3 border-b pb-4"><span className="rounded-lg bg-emerald-100 p-2.5 text-emerald-700"><Settings2 className="h-5 w-5" /></span><div className="min-w-0"><h2 className="text-xl font-bold">File settings</h2><p className="truncate text-xs text-muted-foreground" title={selected?.file.name}>{selected?.file.name}</p></div></div>
        {selected && <fieldset disabled={busy} className="mt-5 space-y-5 disabled:opacity-60">
          <label className="block text-sm font-medium">Password (optional)<input type="password" autoComplete="off" maxLength={255} value={selected.options.password} onChange={(event) => updateOptions(selected.id, { password: event.target.value })} className={`${FIELD} mt-2`} /></label>
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => applySettings()}>Apply settings</Button><Button variant="ghost" size="sm" onClick={() => applySettings(true)}><RotateCcw className="mr-2 h-4 w-4" />Reset</Button></div>
          {selected.inspection && <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Worksheets</h3><button type="button" className="text-xs text-emerald-700 underline dark:text-emerald-400" onClick={() => updateOptions(selected.id, { sheets: selected.inspection!.sheets.map((sheet) => sheet.name) })}><UiText text="Select all" /></button></div><div className="max-h-56 space-y-1 overflow-y-auto">{selected.inspection.sheets.map((sheet) => <label key={sheet.name} className="flex cursor-pointer items-start gap-2 rounded px-1 py-2 text-sm hover:bg-muted"><input type="checkbox" className="mt-1 accent-emerald-600" checked={selected.options.sheets?.includes(sheet.name) ?? false} onChange={(event) => updateOptions(selected.id, { sheets: event.target.checked ? [...(selected.options.sheets ?? []), sheet.name] : selected.options.sheets?.filter((name) => name !== sheet.name) })} /><span className="min-w-0 break-words">{sheet.name}<span className="mt-0.5 block text-xs text-muted-foreground">{sheet.rows} rows · {sheet.columns} columns</span></span></label>)}</div></div>}
          {selected.options.format === "xml" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald-600" checked={selected.options.headerRow} onChange={(event) => updateOptions(selected.id, { headerRow: event.target.checked })} />First row contains column names</label>}
          <p className="text-xs leading-5 text-muted-foreground">{selected.options.format === "xml" || selected.options.format === "csv" ? "Each selected sheet becomes a separate file. Multiple files download together as a ZIP." : selected.options.format === "pdf" ? "Saved cell values and a spreadsheet grid are exported to PDF. Charts and embedded objects are not included." : "Selected worksheets are kept in one workbook. Some Excel-specific formatting and features may change."}</p>
        </fieldset>}
        <div className="mt-7 break-words border-t pt-5">{processing ? <ProcessingState label={label} progress={progress} onCancel={() => activeRun.current?.abort()} /> : <Button onClick={convertAll} disabled={busy || !items.some((item) => item.outputs.length || (item.inspection && item.options.sheets?.length))} className="min-h-14 w-full bg-slate-950 text-base font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700">Convert files<ArrowRight className="ml-2 h-5 w-5" /></Button>}<p className="mt-3 text-center text-xs text-muted-foreground">Converted on your device</p></div>
      </aside>
    </div>
  </div></>;
}
