"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Eraser, Plus, Redo2, Search, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileToolLayout } from "@/components/tool/FileToolLayout";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize } from "@/lib/utils";
import { loadPdfjs } from "@/lib/pdfjs";
import { classifyPdfRenderError, PDF_RENDER_ERROR_MESSAGE } from "@/lib/engines/pdf-render-engine";
import { findRedactionMatches, redactPdf, redactionPageSelection, type RedactionArea, type RedactionMatch, type RedactionSearch } from "@/lib/engines/pdf-redact-engine";
import { useProcessingTask } from "@/lib/use-processing-task";

const fieldClass = "w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm dark:border-slate-700";
const clamp = (n: number, max = 1) => Math.max(0, Math.min(max, n));
const faqs = [
  { question: "How is marked content removed?", answer: "The download is a new PDF containing only rendered page images with your marked areas replaced by solid color. Original text layers, attachments, links, forms and metadata are not copied. Keep the original separately if you need it." },
  { question: "Does text search work on scans?", answer: "Search finds selectable text. Use area marking for scans, pictures or any content search does not find. A match marks its entire text block, so review every area before downloading." },
  { question: "Are my files uploaded?", answer: "No. Preview, search and redaction run in your browser. You can use the tool free without an account." },
];
type Scope = "current" | "all" | "odd" | "even" | "range";
type Drag = { kind: "create" | "move" | "nw" | "ne" | "sw" | "se"; startX: number; startY: number; area: RedactionArea; before: RedactionArea[]; last: RedactionArea };

export function RedactPdfClient() {
  const [file, setFile] = useState<File | null>(null), [pageIndex, setPageIndex] = useState(0), [pageCount, setPageCount] = useState(0);
  const [pageInput, setPageInput] = useState("1"), [loading, setLoading] = useState(false), [pageLoading, setPageLoading] = useState(false), [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; width: number; height: number } | null>(null), [zoom, setZoom] = useState(1);
  const [areas, setAreas] = useState<RedactionArea[]>([]), [selectedId, setSelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<RedactionArea[][]>([]), [future, setFuture] = useState<RedactionArea[][]>([]);
  const [scope, setScope] = useState<Scope>("current"), [range, setRange] = useState("");
  const [searchKind, setSearchKind] = useState<RedactionSearch>("text"), [query, setQuery] = useState(""), [matches, setMatches] = useState<RedactionMatch[] | null>(null);
  const [searching, setSearching] = useState(false), [searchProgress, setSearchProgress] = useState(0);
  const [color, setColor] = useState("#000000"), [dpi, setDpi] = useState<150 | 300>(150), [result, setResult] = useState<Blob | null>(null);
  const { processing, progress, run, cancel } = useProcessingTask();
  const pdfRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null), sourceRef = useRef<Blob | null>(null), boxRef = useRef<HTMLDivElement>(null), dragRef = useRef<Drag | null>(null);
  const generation = useRef(0), searchGeneration = useRef(0), exportAbort = useRef<AbortController | null>(null), autoDownload = useRef(false);
  const selected = areas.find(area => area.id === selectedId);
  const visibleAreas = areas.filter(area => area.pageIndex === pageIndex);

  const stop = () => { exportAbort.current?.abort(); cancel(); };
  const chooseFile = (files: File[]) => {
    if (!files[0]) return;
    generation.current++; searchGeneration.current++; stop(); sourceRef.current = null; dragRef.current = null;
    setFile(files[0]); setPageIndex(0); setPageInput("1"); setPageCount(0); setPreview(null); setError(""); setAreas([]); setPast([]); setFuture([]); setMatches(null); setSearching(false); setSelectedId(null); setResult(null); setZoom(1); autoDownload.current = false;
  };
  const reset = () => {
    generation.current++; searchGeneration.current++; stop(); sourceRef.current = null; dragRef.current = null; setFile(null); setPreview(null); setPageCount(0); setAreas([]); setPast([]); setFuture([]); setSelectedId(null); setResult(null); setError(""); setMatches(null); setSearching(false); autoDownload.current = false;
  };
  useEffect(() => {
    if (!file) return;
    const token = ++generation.current; let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    let active = true, passwordRequired = false; setLoading(true); setError("");
    void (async () => {
      try {
        const pdfjs = await loadPdfjs(), data = await file.arrayBuffer();
        if (!active || token !== generation.current) return;
        sourceRef.current = new Blob([data], { type: "application/pdf" });
        task = pdfjs.getDocument({ data });
        task.onPassword = () => { passwordRequired = true; void task?.destroy(); };
        const pdf = await task.promise;
        if (!active || token !== generation.current) return;
        if (!pdf.numPages) throw new Error("This PDF has no pages.");
        if (pdf.isPureXfa) throw new Error("Export this XFA form as a standard PDF before redacting it.");
        pdfRef.current = pdf; setPageCount(pdf.numPages);
      } catch (failure) {
        if (!active || token !== generation.current) return;
        setError(passwordRequired ? "This PDF is password-protected. Unlock it before redacting." : failure instanceof Error && /XFA|no pages/.test(failure.message) ? failure.message : PDF_RENDER_ERROR_MESSAGE[classifyPdfRenderError(failure)]);
      } finally { if (active && token === generation.current) setLoading(false); }
    })();
    return () => { active = false; pdfRef.current = null; sourceRef.current = null; void task?.destroy(); };
  }, [file]);
  useEffect(() => {
    const pdf = pdfRef.current;
    if (!pdf || !pageCount || processing || result) return;
    let cancelled = false, task: import("pdfjs-dist").RenderTask | undefined;
    setPageLoading(true); setPreview(null);
    void (async () => {
      let canvas: HTMLCanvasElement | undefined;
      try {
        const page = await pdf.getPage(pageIndex + 1);
        if (cancelled) return;
        const physical = page.getViewport({ scale: 1 });
        const scale = Math.min(1.6, Math.sqrt(2_000_000 / (physical.width * physical.height)));
        const viewport = page.getViewport({ scale }); canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        task = page.render({ canvas, viewport, background: "rgb(255,255,255)" }); await task.promise;
        if (!cancelled) setPreview({ url: canvas.toDataURL("image/png"), width: physical.width, height: physical.height });
      } catch (failure) { if (!cancelled) setError(PDF_RENDER_ERROR_MESSAGE[classifyPdfRenderError(failure)]); }
      finally { if (canvas) { canvas.width = 1; canvas.height = 1; } if (!cancelled) setPageLoading(false); }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [file, pageIndex, pageCount, processing, result]);
  useEffect(() => () => { searchGeneration.current++; exportAbort.current?.abort(); }, []);

  const commit = (next: RedactionArea[]) => { setPast(history => [...history.slice(-29), areas]); setFuture([]); setAreas(next); };
  const append = (newAreas: RedactionArea[], visiblePage = pageIndex) => {
    const all = [...areas];
    for (const area of newAreas) if (!all.some(old => old.pageIndex === area.pageIndex && Math.abs(old.x - area.x) < 0.00001 && Math.abs(old.y - area.y) < 0.00001 && Math.abs(old.width - area.width) < 0.00001 && Math.abs(old.height - area.height) < 0.00001)) all.push({ ...area, id: crypto.randomUUID() });
    commit(all); setSelectedId(all.filter(area => area.pageIndex === visiblePage).at(-1)?.id ?? null);
  };
  const point = (event: PointerEvent) => { const rect = boxRef.current!.getBoundingClientRect(); return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) }; };
  const begin = (event: PointerEvent, area?: RedactionArea, kind: Drag["kind"] = "create") => {
    if (pageLoading || processing || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); const { x, y } = point(event);
    const next = area ?? { id: crypto.randomUUID(), pageIndex, x, y, width: 0, height: 0, label: "Area" };
    dragRef.current = { kind, startX: x, startY: y, area: next, last: next, before: areas };
    setSelectedId(next.id); if (!area) setAreas([...areas, next]); boxRef.current?.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    const drag = dragRef.current; if (!drag) return;
    const { x, y } = point(event), dx = x - drag.startX, dy = y - drag.startY, original = drag.area;
    let next = { ...original };
    if (drag.kind === "create") next = { ...original, x: Math.min(x, drag.startX), y: Math.min(y, drag.startY), width: Math.abs(dx), height: Math.abs(dy) };
    else if (drag.kind === "move") next = { ...original, x: clamp(original.x + dx, 1 - original.width), y: clamp(original.y + dy, 1 - original.height) };
    else {
      let left = original.x, top = original.y, right = left + original.width, bottom = top + original.height;
      if (drag.kind.includes("w")) left = Math.min(right - 0.003, clamp(left + dx)); else right = Math.max(left + 0.003, clamp(right + dx));
      if (drag.kind.includes("n")) top = Math.min(bottom - 0.003, clamp(top + dy)); else bottom = Math.max(top + 0.003, clamp(bottom + dy));
      next = { ...original, x: left, y: top, width: right - left, height: bottom - top };
    }
    drag.last = next; setAreas(items => items.map(item => item.id === next.id ? next : item));
  };
  const end = (event: PointerEvent, cancelled = false) => {
    const drag = dragRef.current; if (!drag) return; dragRef.current = null;
    if (cancelled || drag.last.width < 0.003 || drag.last.height < 0.003) { setAreas(drag.before); setSelectedId(null); }
    else { setPast(history => [...history.slice(-29), drag.before]); setFuture([]); }
    if (boxRef.current?.hasPointerCapture(event.pointerId)) boxRef.current.releasePointerCapture(event.pointerId);
  };
  const go = (index: number) => { const n = Math.min(pageCount - 1, Math.max(0, Math.trunc(Number.isFinite(index) ? index : 0))); setPageIndex(n); setPageInput(String(n + 1)); setSelectedId(null); };
  const changeArea = (key: "x" | "y" | "width" | "height", value: number) => {
    if (!selected) return;
    const next = { ...selected, [key]: value / 100 };
    next.x = clamp(next.x, 0.997); next.y = clamp(next.y, 0.997); next.width = Math.max(0.003, Math.min(next.width, 1 - next.x)); next.height = Math.max(0.003, Math.min(next.height, 1 - next.y));
    commit(areas.map(area => area.id === selected.id ? next : area));
  };
  const scopeAction = (whole: boolean) => {
    try {
      const pages = redactionPageSelection(scope, pageIndex, pageCount, range);
      const area = whole ? { x: 0, y: 0, width: 1, height: 1 } : selected;
      if (!area) return;
      append(pages.map(page => ({ ...area, id: crypto.randomUUID(), pageIndex: page, label: whole ? "Whole page" : "Repeated area" })));
    } catch (failure) { toast.error(failure instanceof Error ? failure.message : "Choose valid pages."); }
  };
  const search = async () => {
    const pdf = pdfRef.current; if (!pdf) return;
    const token = ++searchGeneration.current; setSearching(true); setMatches(null); setSearchProgress(0);
    try { const found = await findRedactionMatches(pdf, searchKind, query, () => token !== searchGeneration.current, (done, total) => { if (token === searchGeneration.current) setSearchProgress(Math.round(done / total * 100)); }); if (token === searchGeneration.current) setMatches(found); }
    catch (failure) { if (token === searchGeneration.current) toast.error(failure instanceof Error ? failure.message : "Text search failed."); }
    finally { if (token === searchGeneration.current) setSearching(false); }
  };
  const save = () => {
    const source = sourceRef.current;
    if (!file || !source || !areas.length || loading || pageLoading || error) return;
    setError(""); const controller = new AbortController(); exportAbort.current = controller;
    void run(async (setProgress, isCancelled) => {
      const blob = await redactPdf(source, areas, { dpi, color, isCancelled, signal: controller.signal }, (done, total) => setProgress(Math.round(done / total * 100)));
      if (!isCancelled()) { autoDownload.current = false; setResult(blob); }
    }, { toolName: "redact-pdf", successMessage: "Redacted PDF ready", errorTitle: "Could not redact this PDF", onError: failure => { const message = failure instanceof Error ? failure.message : "Try again with a different PDF."; setError(message); return message; } });
  };

  const pagePreview = <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => append([{ id: crypto.randomUUID(), pageIndex, x: 0.25, y: 0.4, width: 0.5, height: 0.1, label: "Area" }])} disabled={!preview || pageLoading}><Plus className="me-1 h-4 w-4" />Add area</Button>
      <Button variant="outline" size="icon" aria-label="Undo" disabled={!past.length} onClick={() => { setFuture(history => [areas, ...history]); setAreas(past[past.length - 1]); setPast(past.slice(0, -1)); setSelectedId(null); }}><Undo2 className="h-4 w-4" /></Button>
      <Button variant="outline" size="icon" aria-label="Redo" disabled={!future.length} onClick={() => { setPast(history => [...history, areas]); setAreas(future[0]); setFuture(future.slice(1)); setSelectedId(null); }}><Redo2 className="h-4 w-4" /></Button>
      <label className="ms-auto flex items-center gap-2 text-xs">Zoom<select className="rounded border bg-background p-1.5" aria-label="Zoom" value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={1}>Fit</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label>
    </div>
    <p className="text-xs text-muted-foreground">Drag on the page to mark an area. Select a mark to move, resize or remove it.</p>
    {loading || pageLoading ? <p role="status" className="py-16 text-center text-sm">Loading page…</p> : null}
    {preview && <div className="max-h-[70vh] overflow-auto rounded-xl bg-slate-200 p-3 dark:bg-slate-800">
      <div style={{ width: `${zoom * 100}%`, minWidth: 0 }}>
        <div ref={boxRef} role="group" aria-label={`Page ${pageIndex + 1} redaction canvas`} className="relative mx-auto touch-none select-none bg-white shadow-md" style={{ aspectRatio: `${preview.width} / ${preview.height}`, maxWidth: 1000 * zoom }} onPointerDown={e => begin(e)} onPointerMove={move} onPointerUp={e => end(e)} onPointerCancel={e => end(e, true)}>
          {/* User-supplied page pixels are generated locally, not remote web images. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={`Page ${pageIndex + 1}`} draggable={false} className="pointer-events-none h-full w-full" />
          {visibleAreas.map((area, index) => <div key={area.id} role="button" tabIndex={0} aria-label={`Marked area ${index + 1} on page ${pageIndex + 1}`} aria-pressed={area.id === selectedId} onFocus={() => setSelectedId(area.id)} onPointerDown={e => begin(e, area, "move")} onKeyDown={e => { if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); commit(areas.filter(a => a.id !== area.id)); setSelectedId(null); } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); const step = e.shiftKey ? 0.02 : 0.002; commit(areas.map(a => a.id === area.id ? { ...a, x: clamp(a.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0), 1 - a.width), y: clamp(a.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0), 1 - a.height) } : a)); } }} className={`absolute cursor-move border-2 ${area.id === selectedId ? "border-orange-400 ring-2 ring-orange-400/50" : "border-red-500"}`} style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.width * 100}%`, height: `${area.height * 100}%`, background: color, opacity: 0.82 }}>
            {area.id === selectedId && (["nw", "ne", "sw", "se"] as const).map(handle => <span key={handle} aria-hidden onPointerDown={e => begin(e, area, handle)} className={`absolute h-3 w-3 rounded-sm border border-orange-600 bg-white ${handle.includes("n") ? "-top-1.5" : "-bottom-1.5"} ${handle.includes("w") ? "-left-1.5" : "-right-1.5"} ${handle === "nw" || handle === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`} />)}
          </div>)}
        </div>
      </div>
    </div>}
    {pageCount > 0 && <div className="flex items-center justify-center gap-3"><Button aria-label="Previous page" variant="outline" size="icon" disabled={pageIndex === 0 || loading} onClick={() => go(pageIndex - 1)}><ChevronLeft className="h-4 w-4" /></Button><label className="flex items-center gap-2 text-sm">Page<input aria-label="Page number" className="w-16 rounded border bg-background p-2 text-center" type="number" min={1} max={pageCount} value={pageInput} onChange={e => setPageInput(e.target.value)} onBlur={() => go((Number(pageInput) || 1) - 1)} onKeyDown={e => { if (e.key === "Enter") go((Number(pageInput) || 1) - 1); }} />of {pageCount}</label><Button aria-label="Next page" variant="outline" size="icon" disabled={pageIndex === pageCount - 1 || loading} onClick={() => go(pageIndex + 1)}><ChevronRight className="h-4 w-4" /></Button></div>}
  </div>;
  return <FileToolLayout toolSlug="redact-pdf" files={[file]} accept={{ "application/pdf": [".pdf"] }} onFilesSelected={chooseFile} result={result} processing={processing} progress={progress} onCancel={stop} onReset={reset} preview={pagePreview} faqs={faqs} related={[]}>
    {result ? <><ResultState resultFilename="redacted.pdf" fileSize={formatFileSize(result.size)} onDownload={() => downloadBlob(result, "redacted.pdf")} onStartOver={reset} autoDownloadedRef={autoDownload} /><p className="text-center text-sm text-muted-foreground">Your download contains flattened pages. Review the visible result before sharing.</p></> : <>
      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800"><p>{error}</p><Button className="mt-2" variant="outline" size="sm" onClick={() => setError("")}>Dismiss</Button></div>}
      <div className="space-y-3"><h3 className="text-sm font-semibold">Find text to redact</h3><label className="block space-y-1 text-xs">Search for<select aria-label="Search for" className={fieldClass} value={searchKind} onChange={e => { searchGeneration.current++; setSearching(false); setSearchKind(e.target.value as RedactionSearch); setMatches(null); }}><option value="text">Text</option><option value="email">Email addresses</option><option value="phone">Phone numbers</option><option value="card">Payment card numbers</option></select></label>{searchKind === "text" && <input className={fieldClass} aria-label="Text to find" placeholder="Name, number or phrase" value={query} maxLength={200} onChange={e => { searchGeneration.current++; setSearching(false); setQuery(e.target.value); setMatches(null); }} onKeyDown={e => { if (e.key === "Enter" && !searching) void search(); }} />}
        <Button className="w-full" variant="outline" disabled={!pageCount || loading || searching || (searchKind === "text" && !query.trim())} onClick={() => void search()}><Search className="me-2 h-4 w-4" />{searching ? `Searching… ${searchProgress}%` : "Find matches"}</Button>
        {searching && <Button variant="ghost" size="sm" onClick={() => { searchGeneration.current++; setSearching(false); }}>Cancel search</Button>}
        {matches && <div className="space-y-2"><p role="status" className="text-xs">{matches.length ? `${matches.length} matches found. Review the marked text blocks.` : "No selectable text matches found. Use area marking for scans and images."}</p>{matches.length > 0 && <><Button size="sm" className="w-full" onClick={() => append(matches.flatMap(match => match.areas))}>Mark all matches</Button><div className="max-h-36 space-y-1 overflow-y-auto">{matches.map(match => <button key={match.id} type="button" onClick={() => { go(match.pageIndex); append(match.areas, match.pageIndex); }} className="block w-full truncate rounded border p-2 text-left text-xs" title={match.text}>Page {match.pageIndex + 1}: {match.text}</button>)}</div></>}</div>}
        <p className="text-xs leading-5 text-muted-foreground">Search marks whole matching text blocks. Pattern results are candidates; review them and mark any missing content manually.</p>
      </div>
      <div className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Marked areas · {areas.length}</h3>{selected && <><div className="grid grid-cols-2 gap-2">{([["x", "Left %"], ["y", "Top %"], ["width", "Width %"], ["height", "Height %"]] as const).map(([key, label]) => <label key={key} className="text-xs">{label}<input className={fieldClass} aria-label={label} type="number" min={0} max={100} step={0.1} value={Math.round(selected[key] * 1000) / 10} onChange={e => changeArea(key, Number(e.target.value) || 0)} /></label>)}</div><Button className="w-full" variant="outline" size="sm" onClick={() => { commit(areas.filter(area => area.id !== selectedId)); setSelectedId(null); }}><Trash2 className="me-2 h-4 w-4" />Remove selected area</Button></>}
        {areas.length > 0 && <Button variant="ghost" size="sm" onClick={() => { commit([]); setSelectedId(null); }}>Clear all marks</Button>}
        <label className="block space-y-1 text-xs">Apply to pages<select className={fieldClass} aria-label="Apply to pages" value={scope} onChange={e => setScope(e.target.value as Scope)}><option value="current">Current page</option><option value="all">All pages</option><option value="odd">Odd pages</option><option value="even">Even pages</option><option value="range">Page range</option></select></label>{scope === "range" && <input className={fieldClass} aria-label="Page range" placeholder="1, 3-5" value={range} onChange={e => setRange(e.target.value)} />}
        <Button variant="outline" size="sm" className="w-full" disabled={!selected} onClick={() => scopeAction(false)}>Repeat selected area</Button><Button variant="outline" size="sm" className="w-full" disabled={!pageCount || loading} onClick={() => scopeAction(true)}>Mark whole pages</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t pt-4"><label className="space-y-1 text-xs">Fill color<select className={fieldClass} aria-label="Fill color" value={color} onChange={e => setColor(e.target.value)}><option value="#000000">Black</option><option value="#ffffff">White</option></select></label><label className="space-y-1 text-xs">Quality<select className={fieldClass} aria-label="Quality" value={dpi} onChange={e => setDpi(Number(e.target.value) as 150 | 300)}><option value={150}>150 DPI</option><option value={300}>300 DPI</option></select></label></div>
      <p className="rounded-xl bg-slate-100 p-3 text-xs leading-5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">The download will be a new flattened PDF. Searchable text, editable forms, links, attachments and original metadata are removed from the whole document.</p>
      <Button size="lg" className="w-full bg-slate-950 text-white hover:bg-orange-500" disabled={!areas.length || loading || pageLoading || !!error || searching} onClick={save}><Eraser className="me-2 h-4 w-4" />Redact PDF</Button>
    </>}
  </FileToolLayout>;
}
