"use client";

import { useEffect, useRef, useState, type UIEvent } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { FileToolLayout } from "@/components/tool/FileToolLayout";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { comparePdfDocuments, comparisonPdfReport, comparisonTextReport, type ComparisonResult } from "@/lib/engines/pdf-compare-engine";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

const inputClass = "w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm dark:border-slate-700";
interface ComparePdfClientProps { faqs: FaqInput[]; related: ResolvedEntity[] }
type ReadyComparison = { data: ComparisonResult; report: Blob };

function ComparisonViewer({ result, onReset, onAdjust }: { result: ReadyComparison; onReset: () => void; onAdjust: () => void }) {
  const [mode, setMode] = useState<"text" | "overlay" | "side">("side"), [index, setIndex] = useState(0);
  const [query, setQuery] = useState(""), [onlyChanges, setOnlyChanges] = useState(false), [zoom, setZoom] = useState(1), [sync, setSync] = useState(true);
  const left = useRef<HTMLDivElement>(null), right = useRef<HTMLDivElement>(null), syncing = useRef(false);
  const data = result.data, changed = data.pages.filter(page => page.changed).length;
  const visible = data.pages.map((page, n) => ({ page, n })).filter(({ page }) => (!onlyChanges || page.changed) && (!query.trim() || `${page.originalText}\n${page.revisedText}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const active = visible.find(({ n }) => n === index) ?? visible[0], page = active?.page;
  const position = active ? visible.findIndex(({ n }) => n === active.n) : -1;
  const scrollTogether = (event: UIEvent<HTMLDivElement>, other: HTMLDivElement | null) => {
    if (!sync || !other || syncing.current) return;
    syncing.current = true; const current = event.currentTarget;
    other.scrollTop = current.scrollTop / Math.max(1, current.scrollHeight - current.clientHeight) * Math.max(0, other.scrollHeight - other.clientHeight);
    other.scrollLeft = current.scrollLeft / Math.max(1, current.scrollWidth - current.clientWidth) * Math.max(0, other.scrollWidth - other.clientWidth);
    requestAnimationFrame(() => { syncing.current = false; });
  };
  const preview = (source: string | null, label: string) => source ? <div style={{ width: `${zoom * 100}%`, minWidth: "100%" }}>
    {/* Comparison pixels come from local PDF rendering. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={source} alt={label} className="block h-auto w-full bg-white" />
  </div> : <p className="p-10 text-center text-sm text-muted-foreground">Page absent</p>;
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">{changed ? `${changed} changed page ${changed === 1 ? "pair" : "pairs"}` : "No differences detected"}</h2><p className="mt-2 text-sm text-muted-foreground">{data.originalCount} original pages · {data.revisedCount} revised pages · {data.pages.length} page pairs. Visual threshold {data.pixelThreshold}.</p></div>
    <div className="flex flex-wrap gap-2"><Button onClick={() => downloadBlob(result.report, "pdf-comparison-report.pdf")}><Download className="me-2 h-4 w-4" />Download PDF report</Button><Button variant="outline" onClick={() => downloadBlob(new Blob([comparisonTextReport(data)], { type: "text/plain;charset=utf-8" }), "pdf-text-changes.txt")}>Download text changes</Button></div>
    <div className="grid gap-3 sm:grid-cols-2"><input type="search" aria-label="Search comparison text" placeholder="Search original or revised text" className={inputClass} value={query} onChange={e => setQuery(e.target.value)} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyChanges} onChange={e => setOnlyChanges(e.target.checked)} />Changed pages only</label></div>
    <div className="flex flex-wrap gap-2" aria-label="Comparison view">{([['side', 'Side by side'], ['overlay', 'Difference overlay'], ['text', 'Text changes']] as const).map(([value, label]) => <Button key={value} size="sm" variant={mode === value ? "default" : "outline"} aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</Button>)}</div>
    {!page ? <p role="status" className="rounded-xl bg-muted p-6 text-center">No page pairs match this filter.</p> : <>
      <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Previous page pair" disabled={position <= 0} onClick={() => setIndex(visible[position - 1].n)}><ChevronLeft className="h-4 w-4" /></Button><select className={inputClass} aria-label="Page pair" value={active.n} onChange={e => setIndex(Number(e.target.value))}>{visible.map(({ page, n }) => <option key={n} value={n}>Original {page.originalPage ?? "absent"} / Revised {page.revisedPage ?? "absent"}{page.changed ? " · changed" : ""}</option>)}</select><Button variant="outline" size="icon" aria-label="Next page pair" disabled={position >= visible.length - 1} onClick={() => setIndex(visible[position + 1].n)}><ChevronRight className="h-4 w-4" /></Button></div>
      <p className="text-xs leading-5 text-muted-foreground">{page.textChanged ? "Text changed." : "No selectable text changes."} {page.sizeChanged ? "Page size changed." : ""} {(page.changedPixels / page.pixelCount * 100).toFixed(3)}% of rendered pixels changed.{!page.hasText ? " No selectable text on these pages; use the visual views for scans." : ""}</p>
      {mode !== "text" && <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs">Zoom<select className="rounded border bg-background p-2" aria-label="Comparison zoom" value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={1}>Fit</option><option value={1.5}>150%</option><option value={2}>200%</option><option value={3}>300%</option></select></label>{mode === "side" && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={sync} onChange={e => setSync(e.target.checked)} />Sync scrolling</label>}</div>}
      {mode === "side" && <div className="grid min-w-0 gap-3 sm:grid-cols-2"><section className="min-w-0"><h3 className="mb-2 text-sm font-semibold">Original · page {page.originalPage ?? "absent"}</h3><div ref={left} onScroll={e => scrollTogether(e, right.current)} className="max-h-[65vh] overflow-auto rounded-lg border bg-slate-100">{preview(page.originalImage, "Original PDF page")}</div></section><section className="min-w-0"><h3 className="mb-2 text-sm font-semibold">Revised · page {page.revisedPage ?? "absent"}</h3><div ref={right} onScroll={e => scrollTogether(e, left.current)} className="max-h-[65vh] overflow-auto rounded-lg border bg-slate-100">{preview(page.revisedImage, "Revised PDF page")}</div></section></div>}
      {mode === "overlay" && <div className="space-y-3"><p className="text-xs leading-5"><span className="font-semibold text-red-600">Red: darker in original</span> · <span className="font-semibold text-green-700">Green: darker in revised</span> · <span className="font-semibold text-purple-600">Purple: color change</span>. Unchanged content is gray.</p><div className="max-h-[70vh] overflow-auto rounded-lg border bg-slate-100">{preview(page.overlayImage, "PDF difference overlay")}</div></div>}
      {mode === "text" && <div className="space-y-2">{page.coarseTextDiff && <p className="text-xs text-muted-foreground">Detailed matching reached its limit. Full before/after text blocks are shown.</p>}<div className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border bg-muted/30 p-4 text-sm leading-7">{page.hasText ? page.segments.map((part, n) => <span key={n} className={part.added ? "bg-green-100 text-green-950 dark:bg-green-950 dark:text-green-100" : part.removed ? "bg-red-100 text-red-950 line-through dark:bg-red-950 dark:text-red-100" : undefined}>{part.value}</span>) : "No selectable text. Switch to a visual view to compare these pages."}</div><p className="text-xs text-muted-foreground">Green is added text; red strike-through is removed text. {data.ignoreWhitespace ? "Whitespace is normalized." : ""} {data.ignoreCase ? "Letter case is normalized." : ""}</p></div>}
    </>}
    <p className="text-xs leading-5 text-muted-foreground">Visual comparison uses rendered pages at up to 108 DPI. Small changes below the chosen threshold can be missed. Hidden metadata, attachments and digital signatures are not compared. Text extraction does not perform OCR.</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onAdjust}>Adjust comparison</Button><Button variant="outline" onClick={onReset}>Compare another pair</Button></div>
  </div>;
}

export function ComparePdfClient({ faqs, related }: ComparePdfClientProps) {
  const [fileA, setFileA] = useState<File | null>(null), [fileB, setFileB] = useState<File | null>(null), [replacingB, setReplacingB] = useState(false);
  const [result, setResult] = useState<ReadyComparison | null>(null), [error, setError] = useState("");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(true), [ignoreCase, setIgnoreCase] = useState(false), [alignPages, setAlignPages] = useState(true), [threshold, setThreshold] = useState(16);
  const { processing, progress, run, cancel } = useProcessingTask();
  const controller = useRef<AbortController | null>(null);
  const stop = () => { controller.current?.abort(); cancel(); };
  useEffect(() => () => controller.current?.abort(), []);
  const selectA = (files: File[]) => { if (files[0]) { stop(); setFileA(files[0]); setResult(null); setError(""); } };
  const selectB = (files: File[]) => { if (files[0]) { stop(); setFileB(files[0]); setReplacingB(false); setResult(null); setError(""); } };
  const clear = () => { stop(); setFileA(null); setFileB(null); setResult(null); setError(""); setReplacingB(false); };
  const compare = () => {
    if (!fileA || !fileB) return;
    setError(""); const abort = new AbortController(); controller.current = abort;
    void run(async (setProgress, isCancelled) => {
      const data = await comparePdfDocuments(fileA, fileB, { ignoreWhitespace, ignoreCase, alignPages, pixelThreshold: threshold, signal: abort.signal, isCancelled }, value => setProgress(value * 0.85));
      const report = await comparisonPdfReport(data, isCancelled); if (!isCancelled()) { setProgress(100); setResult({ data, report }); }
    }, { toolName: "compare-pdf", successMessage: "Comparison and reports ready", errorTitle: "Could not compare these PDFs", onError: failure => { const message = failure instanceof Error && failure.name === "InvalidPDFException" ? "One of these files is not a readable PDF. Replace it and try again." : failure instanceof Error ? failure.message : "Please try again with valid PDF files."; setError(message); return message; } });
  };
  return <FileToolLayout toolSlug="compare-pdf" files={[fileA, fileB]} accept={{ "application/pdf": [".pdf"] }} multiple={false} selectFilesLabel="Replace original PDF" onFilesSelected={selectA} result={result} processing={processing} progress={progress} onCancel={stop} onReset={clear} onDownload={result ? () => downloadBlob(result.report, "pdf-comparison-report.pdf") : undefined} faqs={faqs} related={related}>
    {result ? <ComparisonViewer result={result} onReset={clear} onAdjust={() => setResult(null)} /> : <>
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <p className="text-sm leading-6 text-muted-foreground">Compare text and visible page content, review the differences, and download a PDF report.</p>
      <div className="space-y-2"><h3 className="text-sm font-semibold">Original PDF</h3><p className="break-all rounded-lg bg-muted p-3 text-sm">{fileA?.name}</p></div>
      <div className="space-y-2"><h3 className="text-sm font-semibold">Revised PDF</h3>{fileB && !replacingB ? <><p className="break-all rounded-lg bg-muted p-3 text-sm">{fileB.name}</p><Button variant="outline" size="sm" onClick={() => setReplacingB(true)}>Replace revised PDF</Button></> : <FileUpload accept={{ "application/pdf": [".pdf"] }} multiple={false} onFilesSelected={selectB} />}{replacingB && fileB && <Button variant="ghost" size="sm" onClick={() => setReplacingB(false)}>Cancel replacement</Button>}</div>
      {fileB && <Button variant="outline" size="sm" disabled={replacingB} onClick={() => { setFileA(fileB); setFileB(fileA); setError(""); }}><ArrowLeftRight className="me-2 h-4 w-4" />Swap PDFs</Button>}
      <div className="space-y-3 border-t pt-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ignoreWhitespace} onChange={e => setIgnoreWhitespace(e.target.checked)} />Ignore text whitespace changes</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ignoreCase} onChange={e => setIgnoreCase(e.target.checked)} />Ignore text letter case</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={alignPages} onChange={e => setAlignPages(e.target.checked)} />Align pages using matching text</label><p className="text-xs leading-5 text-muted-foreground">Matching text helps identify inserted pages. Scanned or unmatched pages are paired in order. Turn alignment off to compare page 1 with page 1, and so on.</p></div>
      <label className="block space-y-2 text-sm">Visual sensitivity<select aria-label="Visual sensitivity" className={inputClass} value={threshold} onChange={e => setThreshold(Number(e.target.value))}><option value={0}>Strict — every pixel difference</option><option value={16}>Balanced</option><option value={48}>Relaxed — ignore small color differences</option></select></label>
      <p className="text-xs leading-5 text-muted-foreground">Files stay on your device. Up to 200 pages per file; image-heavy files may need smaller sections. Scans are compared visually without OCR.</p>
      <Button size="lg" className="w-full" disabled={!fileA || !fileB || replacingB} onClick={compare}>Compare PDFs</Button>
    </>}
  </FileToolLayout>;
}
