"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useDropzone, type Accept, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import { ArrowDownAZ, ArrowUpZA, FileOutput, GripVertical, RotateCw, X, type LucideIcon } from "lucide-react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent, type UniqueIdentifier } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { PdfAddButton, PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { sortFilesByName } from "@/lib/file-sort";
import { useProcessingTask } from "@/lib/use-processing-task";
import { cn, formatFileSize } from "@/lib/utils";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
type Rotation = 0 | 90 | 180 | 270;
type Item = { id: string; file: File; rotation: Rotation };

async function rotatePdf(bytes: Uint8Array, rotation: Rotation) {
  if (rotation === 0) return bytes;
  const { PDFDocument, degrees } = await import("pdf-lib");
  const pdf = await PDFDocument.load(bytes);
  pdf.getPages().forEach((page) => page.setRotation(degrees((page.getRotation().angle + rotation) % 360)));
  return pdf.save();
}

async function parallel<T, R>(items: T[], limit: number, work: (item: T, index: number) => Promise<R>) {
  const output = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; output[index] = await work(items[index], index); }
  }));
  return output;
}

function Card({ item, index, processing, Icon, extension, accent, canRotate, onRemove, onRotate }: {
  item: Item; index: number; processing: boolean; Icon: LucideIcon; extension: string; accent: "orange" | "emerald"; canRotate: boolean; onRemove: () => void; onRotate: () => void;
}) {
  const sortable = useSortable({ id: item.id, disabled: processing });
  const color = accent === "orange" ? "text-orange-600 bg-orange-600 focus-visible:ring-orange-500" : "text-emerald-600 bg-emerald-600 focus-visible:ring-emerald-500";
  return <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? .3 : 1 }} className="group/card relative flex h-[294px] w-[224px] flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_12px_32px_-24px_rgba(15,23,42,.5)] dark:border-slate-700 dark:bg-slate-900">
    <span className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">{formatFileSize(item.file.size)}</span>
    <span className="absolute left-2 top-2 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[11px] font-semibold text-white">{index + 1}</span>
    <div className="absolute right-2 top-2 z-20 flex gap-1.5 md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100">
      {canRotate && <button type="button" aria-label={`Rotate ${item.file.name}`} onClick={onRotate} disabled={processing} className={cn("flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 dark:border-slate-700 dark:bg-slate-900", color.split(" ").at(-1))}><RotateCw className="h-4 w-4" /></button>}
      <button type="button" aria-label={`Remove ${item.file.name}`} onClick={onRemove} disabled={processing} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow transition hover:bg-red-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-slate-700 dark:bg-slate-900"><X className="h-4 w-4" /></button>
    </div>
    <div className="flex min-h-0 flex-1 items-center justify-center pt-3"><div className="flex h-[208px] w-[152px] items-center justify-center bg-white shadow-[0_5px_16px_rgba(15,23,42,.18)] ring-1 ring-slate-200"><div className={cn("flex flex-col items-center transition-transform", color.split(" ")[0])} style={{ transform: `rotate(${item.rotation}deg)` }}><span className={cn("mb-2 rounded px-2 py-.5 text-[10px] font-bold tracking-wide text-white", color.split(" ")[1])}>{extension}</span><Icon className="h-14 w-14" strokeWidth={1.7} /></div></div></div>
    <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800"><button type="button" {...sortable.attributes} {...sortable.listeners} disabled={processing} aria-label={`Drag to reorder ${item.file.name}`} className={cn("flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 dark:hover:bg-slate-800", color.split(" ").at(-1))}><GripVertical className="h-4 w-4" /></button><p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-slate-700 dark:text-slate-200" title={item.file.name}>{item.file.name}</p><span className="h-8 w-8" /></div>
  </article>;
}

export function OfficeToPdfWorkspace({ title, description, buttonLabel, dropLabel, accepted, extension, icon: Icon, accent, canRotate = false, convert, toolName, fidelityNote }: {
  title: string; description: string; buttonLabel: string; dropLabel: string; accepted: Accept; extension: string; icon: LucideIcon; accent: "orange" | "emerald"; canRotate?: boolean; convert: (file: File, onProgress: (value: number) => void, cancelled: () => boolean) => Promise<Blob>; toolName: string; fidelityNote: string;
}) {
  const [items, setItems] = useState<Item[]>([]); const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null); const [result, setResult] = useState<{ blob: Blob; filename: string; count: number } | null>(null); const [label, setLabel] = useState("Preparing your files…");
  const autoDownloadedRef = useRef(false); const { processing, progress, run, cancel } = useProcessingTask();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const addFiles = useCallback((files: File[]) => { const valid = files.filter((file) => file.size <= MAX_FILE_SIZE); if (valid.length !== files.length) toast.error("Each file must be 100MB or smaller."); if (!valid.length) return; setItems((current) => [...current, ...valid.map((file) => ({ id: crypto.randomUUID(), file, rotation: 0 as Rotation }))]); setResult(null); }, []);
  const rejected = useCallback((entries: FileRejection[]) => toast.error(entries.some((entry) => entry.errors.some((error) => error.code === "file-too-large")) ? "Each file must be 100MB or smaller." : `Please choose ${extension} files.`), [extension]);
  const dropzone = useDropzone({ accept: accepted, multiple: true, maxSize: MAX_FILE_SIZE, noClick: true, onDropAccepted: addFiles, onDropRejected: rejected });
  const total = useMemo(() => items.reduce((sum, item) => sum + item.file.size, 0), [items]);
  const sort = (direction: "asc" | "desc") => setItems((current) => { const ordered = sortFilesByName(current.map((item) => item.file), direction); const positions = new Map(ordered.map((file, index) => [file, index])); return [...current].sort((a, b) => (positions.get(a.file) ?? 0) - (positions.get(b.file) ?? 0)); });
  const download = useCallback(() => { if (result) downloadBlob(result.blob, result.filename); }, [result]);
  const convertAll = () => { if (!items.length) return; run(async (setProgress, cancelled) => { setResult(null); autoDownloadedRef.current = false; let done = 0; setLabel(items.length === 1 ? `Converting your ${extension} file…` : `Converting 0 of ${items.length} files…`); const outputs = await parallel(items, 2, async (item) => { if (cancelled()) throw new Error("Cancelled"); const blob = await convert(item.file, () => undefined, cancelled); if (cancelled()) throw new Error("Cancelled"); const bytes = await rotatePdf(new Uint8Array(await blob.arrayBuffer()), canRotate ? item.rotation : 0); done += 1; setProgress((done / items.length) * 100); setLabel(items.length === 1 ? "Finalizing your PDF…" : `Converted ${done} of ${items.length} files…`); return { name: `${safeBaseName(item.file.name)}.pdf`, bytes }; }); if (cancelled()) return; if (outputs.length === 1) setResult({ blob: new Blob([outputs[0].bytes as unknown as BlobPart], { type: "application/pdf" }), filename: outputs[0].name, count: 1 }); else { setLabel("Creating your ZIP download…"); const { zipSync } = await import("fflate"); const entries: Record<string, Uint8Array> = {}; outputs.forEach((output, index) => { let name = output.name; while (entries[name]) name = `${safeBaseName(output.name)}-${index + 1}.pdf`; entries[name] = output.bytes; }); setResult({ blob: new Blob([zipSync(entries) as unknown as BlobPart], { type: "application/zip" }), filename: `${toolName}-pdfs.zip`, count: outputs.length }); } }, { successMessage: "Your PDFs are ready.", toolName, errorTitle: "Couldn’t convert these files", onError: (error) => error instanceof Error && error.message !== "Cancelled" ? error.message : undefined }); };
  if (!items.length && !result) return <PdfToolLanding title={title} description={description} buttonLabel={buttonLabel} dropLabel={dropLabel} limitLabel="Up to 100MB per file" accept={accepted} multiple icon={Icon} iconClass={accent === "orange" ? "text-orange-600" : "text-emerald-600"} iconBackgroundClass={accent === "orange" ? "bg-orange-100" : "bg-emerald-100"} accent={accent} onFilesSelected={addFiles} />;
  if (result) return <PdfToolResultLayout toolSlug={toolName}><ResultState resultFilename={result.filename} fileSize={formatFileSize(result.blob.size)} onDownload={download} onStartOver={() => { setItems([]); setResult(null); }} autoDownloadedRef={autoDownloadedRef} downloadLabel={result.count > 1 ? "Download ZIP again" : "Download PDF again"} /><p className="mx-auto max-w-xl border-t pt-5 text-center text-sm leading-6 text-slate-500">{result.count > 1 ? `${result.count} PDFs are bundled in one download.` : "Your download started automatically."} {fidelityNote}</p></PdfToolResultLayout>;
  const active = items.find((item) => item.id === activeId);
  return <div className="flex flex-1 flex-col bg-slate-50/70 dark:bg-slate-950/40"><PdfWorkspaceBar title={title} meta={`${items.length} file${items.length === 1 ? "" : "s"} · ${formatFileSize(total)} · up to 100MB each`} actions={<><button type="button" onClick={() => sort("asc")} disabled={processing} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-50" aria-label="Sort files A to Z"><ArrowDownAZ className="h-5 w-5" /></button><button type="button" onClick={() => sort("desc")} disabled={processing} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-50" aria-label="Sort files Z to A"><ArrowUpZA className="h-5 w-5" /></button></>} /><div {...dropzone.getRootProps()} className="container mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-4 py-6"><input {...dropzone.getInputProps()} /><div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]"><section className="min-w-0"><DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(event: DragStartEvent) => setActiveId(event.active.id)} onDragEnd={(event: DragEndEvent) => { if (event.over && event.active.id !== event.over.id) setItems((current) => arrayMove(current, current.findIndex((item) => item.id === event.active.id), current.findIndex((item) => item.id === event.over?.id))); setActiveId(null); }} onDragCancel={() => setActiveId(null)}><SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}><div className="flex flex-wrap justify-center gap-4 py-7 sm:justify-start">{items.map((item, index) => <Card key={item.id} item={item} index={index} processing={processing} Icon={Icon} extension={extension} accent={accent} canRotate={canRotate} onRotate={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, rotation: ((entry.rotation + 90) % 360) as Rotation } : entry))} onRemove={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} />)}</div></SortableContext><DragOverlay>{active ? <div className="h-[294px] w-[224px] rounded-2xl border bg-white shadow-2xl" /> : null}</DragOverlay></DndContext><div className="mt-3 flex justify-center lg:justify-start"><PdfAddButton count={items.length} label="Add more files" accent={accent} disabled={processing} onClick={dropzone.open} /></div></section><aside className="flex min-h-[310px] flex-col rounded-3xl border bg-white p-6 shadow-sm dark:bg-slate-900 lg:sticky lg:top-4 lg:h-[calc(100vh-10rem)] lg:min-h-[510px]"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Ready to convert</p><h2 className="mt-2 text-2xl font-bold tracking-tight">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-500">{fidelityNote}</p></div><div className="mt-6 flex-1">{processing && <ProcessingState progress={progress} label={label} onCancel={cancel} />}</div><Button size="lg" disabled={processing} onClick={convertAll} className={cn("mt-6 h-16 w-full text-base font-bold", accent === "orange" ? "bg-orange-600 hover:bg-orange-700" : "bg-emerald-600 hover:bg-emerald-700")}><FileOutput className="mr-2 h-5 w-5" />Convert to PDF</Button></aside></div></div></div>;
}
