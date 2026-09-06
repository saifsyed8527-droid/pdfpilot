"use client";

import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  GripVertical,
  Trash2,
  RotateCw,
  FileText,
  AlertCircle,
  CheckCircle2,
  Lock,
  Info,
  ChevronUp,
  ChevronDown,
  ArrowDownAZ,
  ArrowUpZA,
} from "lucide-react";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize, cn } from "@/lib/utils";
import { sortFilesByName } from "@/lib/file-sort";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  renderFirstPageThumbnailWithInfo,
  classifyPdfRenderError,
} from "@/lib/engines/pdf-render-engine";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DragEndEvent, UniqueIdentifier } from "@dnd-kit/core";
import { getCategoryStyle } from "@/lib/category-colors";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { PdfAddButton, PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { getTool } from "@/lib/tools";

const tool = getTool("/merge-pdf")!;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

type FileError = "password" | "unreadable";

interface SortableFileCardProps {
  file: File;
  index: number;
  isLast: boolean;
  pageCount: number | undefined;
  thumbnail: string | undefined | null;
  rotation: number;
  error: FileError | undefined;
  isDuplicate: boolean;
  removeFile: (index: number) => void;
  moveFile: (index: number, direction: -1 | 1) => void;
  rotateFile: (index: number) => void;
}

/** One document tile in the merge workspace grid — thumbnail-dominant, with
 *  rotate/remove as small icon controls overlaid on the thumbnail's own
 *  corner and the whole card itself as the drag handle (grab anywhere on
 *  the card, not a separate handle column), matching how a page-preview
 *  grid actually reads: each tile *is* one document in the sequence. Mobile
 *  keeps explicit up/down buttons since drag alone isn't a reliable touch
 *  affordance, and rotate/remove stay visible without hover on touch. */
function SortableFileCard({
  file,
  index,
  isLast,
  pageCount,
  thumbnail,
  rotation,
  error,
  isDuplicate,
  removeFile,
  moveFile,
  rotateFile,
}: SortableFileCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: file.name + index });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 999 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative flex min-h-[302px] w-[234px] flex-col rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] transition-shadow hover:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-slate-900 cursor-grab active:cursor-grabbing touch-none",
        error && "border-destructive/40"
      )}
    >
      <div className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {formatFileSize(file.size)}{pageCount ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}
      </div>
      <div
        className={cn(
          "relative flex h-[236px] items-center justify-center overflow-hidden rounded-xl",
          error ? "bg-destructive/5" : "bg-muted"
        )}
      >
        {error === "password" ? (
          <div className="h-full w-full flex items-center justify-center">
            <Lock className="h-6 w-6 text-destructive" aria-hidden />
          </div>
        ) : thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot, not an optimizable remote asset
          <img
            src={thumbnail}
            alt=""
            className="h-full w-full object-contain transition-transform duration-200"
            style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
          />
        ) : thumbnail === null ? (
          <div className="h-full w-full flex items-center justify-center">
            <FileText className={cn("h-6 w-6", error ? "text-destructive" : "text-muted-foreground")} aria-hidden />
          </div>
        ) : (
          <div className="h-full w-full animate-pulse bg-muted-foreground/10" aria-hidden />
        )}

        <span
          className="absolute top-1.5 left-1.5 flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shadow"
          aria-hidden="true"
        >
          {index + 1}
        </span>

        {/* Rotate/remove live on the thumbnail's own corner, same spot a
           real document viewer puts page controls - visible without hover
           on touch/mobile, hover-revealed on desktop pointer input. */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 has-[:focus-visible]:opacity-100 transition-opacity">
          {!error && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                rotateFile(index);
              }}
              aria-label={`Rotate ${file.name}`}
              title="Rotate 90°"
              className="flex items-center justify-center h-7 w-7 rounded-full bg-white/95 dark:bg-slate-800/95 border shadow text-foreground hover:text-primary transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              removeFile(index);
            }}
            aria-label={`Remove ${file.name}`}
            className="flex items-center justify-center h-7 w-7 rounded-full bg-white/95 dark:bg-slate-800/95 border shadow text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Touch-friendly manual reorder, since drag alone isn't reliable
           on touch and rotate/remove already occupy the top corners. */}
        <div
          className="md:hidden absolute bottom-1.5 right-1.5 flex flex-col rounded-full bg-white/95 dark:bg-slate-800/95 border shadow overflow-hidden"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); moveFile(index, -1); }}
            disabled={index === 0}
            aria-label={`Move ${file.name} up`}
            className="h-6 w-7 flex items-center justify-center text-foreground disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); moveFile(index, 1); }}
            disabled={isLast}
            aria-label={`Move ${file.name} down`}
            className="h-6 w-7 flex items-center justify-center text-foreground disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 min-w-0 border-t border-slate-100 pt-2 dark:border-slate-800">
        <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
        {error === "password" ? (
          <p className="text-xs text-destructive">Password protected</p>
        ) : error === "unreadable" ? (
          <p className="text-xs text-destructive">Couldn&apos;t read this file</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {pageCount === undefined ? "…" : `${pageCount} page${pageCount === 1 ? "" : "s"}`}
            {" · "}
            {formatFileSize(file.size)}
          </p>
        )}
        {isDuplicate && !error && (
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Possible duplicate</p>
        )}
      </div>
    </div>
  );
}

export function MergePdfClient() {
  const [files, setFiles] = useState<File[]>([]);
  const [mergedPdf, setMergedPdf] = useState<Blob | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [pageCounts, setPageCounts] = useState<Map<File, number>>(new Map());
  const [pageSizes, setPageSizes] = useState<Map<File, { width: number; height: number }>>(new Map());
  const [thumbnails, setThumbnails] = useState<Map<File, string | null>>(new Map());
  const [rotations, setRotations] = useState<Map<File, number>>(new Map());
  const [fileErrors, setFileErrors] = useState<Map<File, FileError>>(new Map());
  const { processing, progress, failed, run, cancel } = useProcessingTask();
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const autoDownloadRef = useRef<boolean>(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((_, i) => items[i].name + i === active.id);
        const newIndex = items.findIndex((_, i) => items[i].name + i === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    setFiles((items) => {
      if (target < 0 || target >= items.length) return items;
      return arrayMove(items, index, target);
    });
  };

  const sortFiles = (direction: "asc" | "desc") => {
    setFiles((prev) => sortFilesByName(prev, direction));
  };

  const handleFilesSelected = (newFiles: File[]) => {
    const validFiles = newFiles.filter((file) => file.size <= MAX_FILE_SIZE);
    if (validFiles.length !== newFiles.length) toast.error("Each PDF must be 100MB or smaller.");
    if (validFiles.length === 0) return;
    setFiles((prev) => [...prev, ...validFiles]);
    setMergedPdf(null);

    validFiles.forEach((file) => {
      // One pdfjs-dist parse per file instead of two separate full parses
      // (previously: a pdf-lib load for page count/size, plus an entirely
      // separate pdfjs-dist load for the thumbnail) — see
      // renderFirstPageThumbnailWithInfo's own doc comment for the full
      // rationale. classifyPdfRenderError also gives real password/corrupt
      // classification straight from pdfjs's own exception types, rather
      // than string-matching pdf-lib's error message for "is encrypted".
      renderFirstPageThumbnailWithInfo(file)
        .then(({ thumbnail, pageCount, firstPageSize }) => {
          setThumbnails((prev) => new Map(prev).set(file, thumbnail));
          setPageCounts((prev) => new Map(prev).set(file, pageCount));
          setPageSizes((prev) => new Map(prev).set(file, firstPageSize));
        })
        .catch((error) => {
          const kind = classifyPdfRenderError(error);
          setFileErrors((prev) => new Map(prev).set(file, kind === "password" ? "password" : "unreadable"));
          setThumbnails((prev) => new Map(prev).set(file, null));
        });
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const rotateFile = (index: number) => {
    const file = files[index];
    if (!file) return;
    setRotations((prev) => new Map(prev).set(file, ((prev.get(file) ?? 0) + 90) % 360));
  };

  const clearAll = () => {
    setFiles([]);
    setMergedPdf(null);
  };

  const mergePDFs = () => {
    if (files.length === 0) return;

    run(
      async (setProgress, isCancelled) => {
        setMergedPdf(null);
        autoDownloadRef.current = false;
        const { PDFDocument, degrees } = await import("pdf-lib");
        const mergedPdfDoc = await PDFDocument.create();
        const totalFiles = files.length;

        // Reading file bytes is pure I/O and every file is independent, so
        // all reads happen concurrently instead of one `await
        // file.arrayBuffer()` per loop iteration serializing I/O wait time
        // that has no reason to be serial. `copyPages`/`addPage` below still
        // run strictly in array order in a single loop against the one
        // shared `mergedPdfDoc`, so merge order is unchanged.
        const buffers = await Promise.all(files.map((file) => file.arrayBuffer()));

        for (let i = 0; i < totalFiles; i++) {
          if (isCancelled()) return;
          const file = files[i];
          const pdf = await PDFDocument.load(buffers[i]);
          const copiedPages = await mergedPdfDoc.copyPages(pdf, pdf.getPageIndices());
          const userRotation = rotations.get(file) ?? 0;

          copiedPages.forEach((page) => {
            if (userRotation !== 0) {
              const existing = page.getRotation().angle;
              page.setRotation(degrees((existing + userRotation) % 360));
            }
            mergedPdfDoc.addPage(page);
          });
          setProgress(((i + 1) / totalFiles) * 100);
        }

        if (isCancelled()) return;

        const pdfBytes = await mergedPdfDoc.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setMergedPdf(blob);
      },
      {
        successMessage: "PDF merged successfully!",
        toolName: "merge-pdf",
        errorTitle: "Failed to merge PDF",
        onError: (error) => {
          console.error("Error merging PDFs:", error);
          return "Please try again with valid PDF files";
        },
      }
    );
  };

  const downloadMergedPdf = () => {
    if (!mergedPdf) return;
    downloadBlob(mergedPdf, "merged.pdf");
  };

  const fileIds = useMemo(() => files.map((file, i) => file.name + i), [files]);

  const totalSizeMb = useMemo(
    () => (files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2),
    [files]
  );

  const totalPages = useMemo(() => {
    if (files.length === 0) return null;
    let sum = 0;
    for (const file of files) {
      const count = pageCounts.get(file);
      if (count === undefined) return null;
      sum += count;
    }
    return sum;
  }, [files, pageCounts]);

  const duplicateIndices = useMemo(() => {
    const seen = new Map<string, number>();
    const duplicates = new Set<number>();
    files.forEach((file, index) => {
      const key = `${file.name}:${file.size}`;
      if (seen.has(key)) duplicates.add(index);
      else seen.set(key, index);
    });
    return duplicates;
  }, [files]);

  const hasBlockingError = useMemo(
    () => files.some((file) => fileErrors.has(file)),
    [files, fileErrors]
  );

  const isLargeMerge = Number(totalSizeMb) > 50;

  const hasMixedPageSizes = useMemo(() => {
    if (files.length < 2) return false;
    const normalized = new Set<string>();
    for (const file of files) {
      const size = pageSizes.get(file);
      if (!size) return false;
      const [a, b] = [Math.round(size.width), Math.round(size.height)].sort((x, y) => x - y);
      normalized.add(`${a}x${b}`);
    }
    return normalized.size > 1;
  }, [files, pageSizes]);

  const style = getCategoryStyle(tool);
  const ToolIcon = tool.icon;
  const canMerge = files.length >= 2 && !hasBlockingError;

  if (mergedPdf) {
    return (
      <PdfToolResultLayout toolSlug="merge-pdf">
        <ResultState resultFilename="merged.pdf" fileSize={formatFileSize(mergedPdf.size)} onDownload={downloadMergedPdf} downloadLabel="Download PDF" onStartOver={clearAll} autoDownloadedRef={autoDownloadRef} />
      </PdfToolResultLayout>
    );
  }

  if (files.length === 0) {
    return (
      <PdfToolLanding
        title="Merge PDF"
        description="Combine multiple PDFs into one polished document. Arrange the order, rotate files, and merge in seconds."
        buttonLabel="Select PDF files"
        dropLabel="or drag and drop PDF files here"
        limitLabel="100MB max per PDF"
        accept={{ "application/pdf": [".pdf"] }}
        multiple
        icon={ToolIcon}
        iconClass={style.iconClass}
        iconBackgroundClass={style.bgClass}
        accent="orange"
        onFilesSelected={handleFilesSelected}
      />
    );
  }

  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50">
      <PdfWorkspaceBar
        title="Merge PDF"
        meta={<>{files.length} file{files.length === 1 ? "" : "s"}{totalPages !== null && ` · ${totalPages} page${totalPages === 1 ? "" : "s"}`} · {totalSizeMb} MB · drag to reorder</>}
        actions={<><input ref={addMoreInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(event) => { const selected = Array.from(event.target.files ?? []); if (selected.length) handleFilesSelected(selected); event.target.value = ""; }} />{files.length > 1 && <><Button variant="outline" size="sm" onClick={() => sortFiles("asc")} disabled={processing}><ArrowDownAZ className="h-4 w-4" /> A–Z</Button><Button variant="outline" size="sm" onClick={() => sortFiles("desc")} disabled={processing}><ArrowUpZA className="h-4 w-4" /> Z–A</Button></>}<Button variant="ghost" size="sm" onClick={clearAll} disabled={processing}>Clear</Button></>}
      />
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative min-h-[620px] border-b p-5 lg:border-b-0 lg:border-r lg:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Arrange your PDFs</p><p className="mt-1 text-xs text-slate-500">Drag files into order. Hover for size, rotate, and remove controls.</p></div>
              <PdfAddButton count={files.length} label="Add more PDFs" accent="orange" disabled={processing} onClick={() => addMoreInputRef.current?.click()} />
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={fileIds} strategy={verticalListSortingStrategy}>
                <div className="grid grid-cols-1 justify-items-center gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                  {files.map((file, index) => <SortableFileCard key={file.name + index} file={file} index={index} isLast={index === files.length - 1} pageCount={pageCounts.get(file)} thumbnail={thumbnails.get(file)} rotation={rotations.get(file) ?? 0} error={fileErrors.get(file)} isDuplicate={duplicateIndices.has(index)} removeFile={removeFile} moveFile={moveFile} rotateFile={rotateFile} />)}
                </div>
              </SortableContext>
              <DragOverlay>{activeId ? <div className="flex w-56 items-center gap-3 rounded-xl border bg-white p-3 shadow-2xl dark:bg-slate-900"><GripVertical className="h-4 w-4 text-slate-400" /><p className="truncate text-sm font-medium">{files.find((_, i) => files[i].name + i === activeId)?.name}</p></div> : null}</DragOverlay>
            </DndContext>
          </div>
        </section>
        <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[560px] lg:p-6">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-5 flex items-center gap-3 border-b pb-4"><span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", style.bgClass)}><ToolIcon className={cn("h-5 w-5", style.iconClass)} /></span><div><h2 className="text-xl font-bold tracking-tight">Merge options</h2><p className="text-xs text-slate-500">Files merge in the order shown</p></div></div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><p className="flex items-center gap-2 text-sm font-medium">{!failed && canMerge && <CheckCircle2 className="h-4 w-4 text-emerald-600" />} {files.length} PDF{files.length === 1 ? "" : "s"} selected</p><p className="mt-1 text-xs text-slate-500">{totalPages ?? "…"} pages · {totalSizeMb} MB total</p></div>
              {isLargeMerge && <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"><Info className="mt-0.5 h-4 w-4 shrink-0" />Large merge — this may take a little longer than usual.</div>}
              {hasMixedPageSizes && <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"><Info className="mt-0.5 h-4 w-4 shrink-0" />Mixed page sizes will keep their original dimensions.</div>}
              {hasBlockingError && <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Remove the marked file before merging.</div>}
              {failed && <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Merge failed. Your original files are safe.</div>}
              {!failed && files.length === 1 && <p className="text-sm text-slate-500">Add one more PDF to enable merging.</p>}
            </div>
            {processing ? <div className="mt-5 shrink-0"><ProcessingState progress={progress} onCancel={cancel} label="Merging PDFs…" /></div> : <button type="button" onClick={mergePDFs} disabled={failed ? false : !canMerge} className="mt-5 flex min-h-16 w-full shrink-0 items-center justify-center gap-3 rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0">{failed ? "Try Again" : `Merge ${files.length} PDFs`}</button>}
            <p className="mt-3 text-center text-xs text-slate-500">Browser-local merging · nothing is uploaded</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
