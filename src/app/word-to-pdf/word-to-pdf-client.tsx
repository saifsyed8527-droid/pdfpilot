"use client";

import { UiText, useToolCopy } from "@/components/i18n/UiText";
import { conversionCopy } from "@/lib/i18n/conversion-copy";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import { ArrowDownAZ, ArrowRight, ArrowUpZA, FileOutput, FileType, GripVertical, RotateCw, ShieldCheck, X } from "lucide-react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent, type UniqueIdentifier } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { PdfAddButton, PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { getCategoryStyle } from "@/lib/category-colors";
import { downloadBlob } from "@/lib/download-file";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { convertWordToPdf } from "@/lib/engines/word-pdf-engine";
import { wordPdfFilename } from "@/lib/engines/word-pdf-policy";
import { sortFilesByName } from "@/lib/file-sort";
import { getTool } from "@/lib/tools";
import { useProcessingTask } from "@/lib/use-processing-task";
import { cn, formatFileSize } from "@/lib/utils";

const tool = getTool("/word-to-pdf")!;
const toolStyle = getCategoryStyle(tool);
const ToolIcon = tool.icon;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED_WORD_FILES = { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] };

type Rotation = 0 | 90 | 180 | 270;
interface WordItem { id: string; file: File; rotation: Rotation }
interface ConversionResult { blob: Blob; filename: string; fileCount: number; pagePreviews?: string[] }

async function withConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
}

function CardAction({ label, destructive, disabled, onClick, children }: { label: string; destructive?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onClick(); }} disabled={disabled} aria-label={label} className={cn("flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900", destructive ? "hover:bg-red-500 hover:text-white" : "hover:bg-amber-500 hover:text-slate-950")}>
      {children}
    </button>
  );
}

function WordFileCard({ item, index, processing, onRotate, onRemove }: { item: WordItem; index: number; processing: boolean; onRotate: (id: string) => void; onRemove: (id: string) => void }) {
  const sortable = useSortable({ id: item.id, disabled: processing });
  return (
    <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.28 : 1 }} className="group/card relative flex h-[302px] w-[234px] flex-col rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] transition-shadow hover:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-slate-900">
      <div className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">{formatFileSize(item.file.size)}</div>
      <span className="absolute left-2 top-2 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[11px] font-semibold tabular-nums text-white shadow">{index + 1}</span>
      <div className="absolute right-2 top-2 z-20 flex gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100">
        <CardAction label={`Rotate ${item.file.name}`} onClick={() => onRotate(item.id)} disabled={processing}><RotateCw className="h-4 w-4" aria-hidden /></CardAction>
        <CardAction label={`Remove ${item.file.name}`} onClick={() => onRemove(item.id)} disabled={processing} destructive><X className="h-4 w-4" aria-hidden /></CardAction>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center pt-3">
        <div className="flex h-[218px] w-[158px] items-center justify-center bg-white shadow-[0_5px_16px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 dark:bg-slate-50 dark:ring-slate-600">
          <div className="flex flex-col items-center text-blue-700 transition-transform duration-200 motion-reduce:transition-none" style={{ transform: `rotate(${item.rotation}deg)` }}><span className="mb-2 rounded bg-blue-700 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">DOCX</span><FileType className="h-14 w-14" strokeWidth={1.7} aria-hidden /></div>
        </div>
      </div>
      <div className="mt-2 flex w-full items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
        <button type="button" {...sortable.attributes} {...sortable.listeners} disabled={processing} className="flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-default dark:hover:bg-slate-800" aria-label={`Drag to reorder ${item.file.name}`}><GripVertical className="h-4 w-4" aria-hidden /></button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-slate-700 dark:text-slate-200" title={item.file.name}>{item.file.name}</p><span className="h-8 w-8 shrink-0" aria-hidden />
      </div>
    </article>
  );
}

export function WordToPdfClient() {
  const { locale, t } = useToolCopy();
  const [items, setItems] = useState<WordItem[]>([]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [processingLabel, setProcessingLabel] = useState("Converting Word to PDF…");
  const [conversionError, setConversionError] = useState("");
  const { processing: taskProcessing, progress, failed, run, cancel } = useProcessingTask();
  const [rendererActive, setRendererActive] = useState(false);
  const processing = taskProcessing || rendererActive;
  const showFailure = failed && Boolean(conversionError);
  const autoDownloadRef = useRef(false);
  // Keep cancellation local until the current renderer has released its resources.
  const conversionBusyRef = useRef(false);
  const conversionCancelledRef = useRef(false);
  useEffect(() => () => { conversionCancelledRef.current = true; }, []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const addFiles = useCallback((files: File[]) => {
    const valid = files.filter((file) => file.size <= MAX_FILE_SIZE && file.name.toLowerCase().endsWith(".docx"));
    if (valid.length !== files.length) toast.error("Choose DOCX files up to 100MB each.");
    if (!valid.length) return;
    setItems((current) => [...current, ...valid.map((file) => ({ id: crypto.randomUUID(), file, rotation: 0 as Rotation }))]);
    setResult(null); setConversionError("");
  }, []);

  const onRejected = useCallback((rejections: FileRejection[]) => {
    const tooLarge = rejections.some((rejection) => rejection.errors.some((error) => error.code === "file-too-large"));
    toast.error(tooLarge ? "Each DOCX file must be 100MB or smaller." : "Please choose a DOCX file.");
  }, []);
  const dropzone = useDropzone({ accept: ACCEPTED_WORD_FILES, multiple: true, maxSize: MAX_FILE_SIZE, noClick: true, disabled: processing, onDropAccepted: addFiles, onDropRejected: onRejected });
  const totalBytes = useMemo(() => items.reduce((sum, item) => sum + item.file.size, 0), [items]);
  const activeItem = items.find((item) => item.id === activeId);
  const clearAll = () => { setItems([]); setResult(null); setConversionError(""); setActiveId(null); };
  const removeItem = (id: string) => setItems((current) => current.filter((item) => item.id !== id));
  const rotateItem = (id: string) => setItems((current) => current.map((item) => item.id === id ? { ...item, rotation: ((item.rotation + 90) % 360) as Rotation } : item));
  const sortItems = (direction: "asc" | "desc") => setItems((current) => { const sorted = sortFilesByName(current.map((item) => item.file), direction); const order = new Map(sorted.map((file, index) => [file, index])); return [...current].sort((a, b) => (order.get(a.file) ?? 0) - (order.get(b.file) ?? 0)); });
  const handleDragEnd = (event: DragEndEvent) => { if (event.over && event.active.id !== event.over.id) setItems((current) => { const from = current.findIndex((item) => item.id === event.active.id); const to = current.findIndex((item) => item.id === event.over?.id); return from >= 0 && to >= 0 ? arrayMove(current, from, to) : current; }); setActiveId(null); };

  const convertToPdf = () => {
    if (!items.length || conversionBusyRef.current) return;
    conversionBusyRef.current = true;
    setRendererActive(true);
    conversionCancelledRef.current = false;
    run(async (setProgress, isCancelled) => {
      const stopped = () => isCancelled() || conversionCancelledRef.current;
      try {
      setResult(null); setConversionError(""); autoDownloadRef.current = false;
      let completed = 0;
      const pagePreviews: string[] = [];
      setProcessingLabel(items.length === 1 ? "Reading your Word document…" : `Converting 0 of ${items.length} documents…`);
      const outputs = await withConcurrency(items, 1, async (item) => {
        const pdfBlob = await convertWordToPdf(item.file, { isCancelled: stopped, rotation: item.rotation, onPagePreview: items.length === 1 ? (image) => pagePreviews.push(image) : undefined, onProgress: (value, label) => {
          if (!stopped()) { setProgress((completed + value / 100) / items.length * 100); setProcessingLabel(items.length === 1 ? label : `Document ${completed + 1} of ${items.length}: ${label}`); }
        } });
        if (stopped()) throw new Error("Conversion cancelled.");
        const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
        completed += 1; setProgress((completed / items.length) * 100);
        setProcessingLabel(items.length === 1 ? "Finalizing your PDF…" : `Converted ${completed} of ${items.length} documents…`);
        return { name: wordPdfFilename(item.file.name), bytes };
      });
      if (stopped()) return;
      if (outputs.length === 1) setResult({ blob: new Blob([outputs[0].bytes as unknown as BlobPart], { type: "application/pdf" }), filename: outputs[0].name, fileCount: 1, pagePreviews });
      else {
        setProcessingLabel("Creating your download…");
        const { zipSync } = await import("fflate");
        const entries: Record<string, Uint8Array> = {};
        outputs.forEach((output, index) => { const name = entries[output.name] ? `${safeBaseName(output.name)}_${index + 1}.pdf` : output.name; entries[name] = output.bytes; });
        const zipped = zipSync(entries);
        setResult({ blob: new Blob([zipped as unknown as BlobPart], { type: "application/zip" }), filename: "converted_word_files.zip", fileCount: outputs.length });
      }
      } finally { conversionBusyRef.current = false; setRendererActive(false); }
    }, { successMessage: items.length === 1 ? "Your PDF is ready!" : "Your PDF files are ready!", toolName: "word-to-pdf", errorTitle: "Could not convert this Word document", onError: (error) => {
      const message = error instanceof Error ? error.message : "Please try again with a valid DOCX file.";
      setConversionError(message);
      // The shared hook also reports this string to analytics. Keep detailed
      // parser errors local so document-derived content cannot enter telemetry.
      return "Browser Word conversion could not preserve this document. See the on-page explanation.";
    } });
  };
  const cancelConversion = () => { conversionCancelledRef.current = true; setProcessingLabel("Stopping conversion safely…"); cancel(); };
  const downloadResult = useCallback(() => { if (result) downloadBlob(result.blob, result.filename); }, [result]);

  if (result) return (
    <PdfToolResultLayout toolSlug="word-to-pdf">
      <div data-clarity-mask="True">
        <ResultState resultFilename={result.filename} fileSize={formatFileSize(result.blob.size)} onDownload={downloadResult} downloadLabel={result.fileCount > 1 ? "Download ZIP" : "Download PDF"} onStartOver={clearAll} autoDownloadedRef={autoDownloadRef} />
        {result.pagePreviews && <details className="mt-6 rounded-xl border p-4">
          <summary className="cursor-pointer font-medium">Preview all {result.pagePreviews.length} pages before sharing</summary>
          <p className="my-3 text-sm text-muted-foreground">These are the pages included in your PDF. Text is image-based, not searchable. Review fonts and page breaks before sharing.</p>
          <div className="grid gap-6">{result.pagePreviews.map((src, index) => <figure key={index}>
            <figcaption className="mb-2 text-sm text-muted-foreground">Page {index + 1}</figcaption>
            {/* Local data images must never go through a server image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Converted document page ${index + 1}`} className="mx-auto h-auto max-w-full bg-white shadow" data-clarity-mask="True" />
          </figure>)}</div>
        </details>}
      </div>
    </PdfToolResultLayout>
  );
  if (!items.length) return <PdfToolLanding title="Word to PDF" description="Turn DOCX documents into clean, shareable PDFs. Add one file or a whole batch and download in seconds." buttonLabel="Select Word files" dropLabel="or drag and drop DOCX files here" limitLabel="100MB max per document" accept={ACCEPTED_WORD_FILES} multiple icon={ToolIcon} iconClass={toolStyle.iconClass} iconBackgroundClass={toolStyle.bgClass} accent="amber" onFilesSelected={addFiles} />;

  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50" data-clarity-mask="True">
      <PdfWorkspaceBar title="Word to PDF" meta={<>{items.length} document{items.length === 1 ? "" : "s"} · {formatFileSize(totalBytes)} · drag to reorder</>} actions={<>{items.length > 1 && <><Button variant="outline" size="sm" onClick={() => sortItems("asc")} disabled={processing}><ArrowDownAZ className="h-4 w-4" aria-hidden /> A–Z</Button><Button variant="outline" size="sm" onClick={() => sortItems("desc")} disabled={processing}><ArrowUpZA className="h-4 w-4" aria-hidden /> Z–A</Button></>}<Button variant="ghost" size="sm" onClick={clearAll} disabled={processing}><UiText text="Clear" /></Button></>} />
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <section {...dropzone.getRootProps()} className="relative min-h-[620px] border-b p-5 focus-visible:outline-none lg:border-b-0 lg:border-r lg:p-8" aria-label="Selected Word documents workspace. Drop more DOCX files anywhere in this area.">
          <input {...dropzone.getInputProps()} />
          {dropzone.isDragActive && <div className="absolute inset-4 z-30 flex items-center justify-center rounded-3xl border-2 border-dashed border-amber-500 bg-amber-50/95 text-center dark:bg-amber-950/90"><div><FileType className="mx-auto h-10 w-10 text-amber-600" aria-hidden /><p className="mt-3 text-lg font-semibold">Drop to add Word files</p></div></div>}
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Your Word documents</p><p className="mt-1 text-xs text-slate-500">Hover a document for size, rotate, and remove controls.</p></div><PdfAddButton count={items.length} label="Add more Word files" accent="amber" disabled={processing} onClick={dropzone.open} /></div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(event: DragStartEvent) => setActiveId(event.active.id)} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}><div className="grid grid-cols-1 justify-items-center gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">{items.map((item, index) => <WordFileCard key={item.id} item={item} index={index} processing={processing} onRotate={rotateItem} onRemove={removeItem} />)}</div></SortableContext>
              <DragOverlay>{activeItem ? <div className="flex w-56 items-center gap-3 rounded-xl border bg-white p-3 shadow-2xl dark:bg-slate-900"><GripVertical className="h-4 w-4 text-slate-400" aria-hidden /><p className="truncate text-sm font-medium">{activeItem.file.name}</p></div> : null}</DragOverlay>
            </DndContext>
          </div>
        </section>
        <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[560px] lg:p-6">
          <div className="flex min-h-0 flex-col lg:h-full">
            <div className="mb-5 flex shrink-0 items-center gap-3 border-b pb-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><FileOutput className="h-5 w-5" aria-hidden /></span><div><h2 className="text-xl font-bold tracking-tight"><UiText text="Word to PDF" /></h2><p className="text-xs text-slate-500"><UiText text="One PDF per Word document" /></p></div></div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {showFailure && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{conversionError}</p>}
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><p className="text-sm font-semibold">{items.length} DOCX file{items.length === 1 ? "" : "s"} ready</p><p className="mt-1 text-xs leading-5 text-slate-500">{items.length === 1 ? "Your PDF will download automatically when conversion finishes." : "Each document becomes its own PDF inside one ZIP download."}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600 dark:bg-slate-950/60 dark:text-slate-300"><p className="font-semibold text-slate-800 dark:text-slate-100">{t("Images, tables and visual formatting")}</p><p className="mt-1">{conversionCopy(locale, "word-to-pdf").limitations}</p></div>
            </div>
            {processing ? <div className="mt-5 shrink-0"><ProcessingState progress={progress} label={processingLabel} onCancel={cancelConversion} /></div> : <button type="button" onClick={convertToPdf} className="mt-5 flex min-h-16 w-full shrink-0 items-center justify-center gap-3 rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-500 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 motion-reduce:hover:translate-y-0">{t(showFailure ? "Try Again" : "Convert to PDF")}<ArrowRight className="h-5 w-5" aria-hidden /></button>}
            <p className="mt-3 flex shrink-0 items-center justify-center gap-2 text-center text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden /><UiText text="Browser-local conversion · nothing is uploaded" /></p>
          </div>
        </aside>
      </div>
    </div>
  );
}
