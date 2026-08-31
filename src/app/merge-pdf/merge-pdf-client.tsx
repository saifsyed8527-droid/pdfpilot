"use client";

import { useState, useMemo, useRef } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import {
  GripVertical,
  Trash2,
  RotateCw,
  FileText,
  ArrowLeft,
  Plus,
  AlertCircle,
  CheckCircle2,
  Lock,
  Info,
  ChevronUp,
  ChevronDown,
  ArrowDownAZ,
  ArrowUpZA,
} from "lucide-react";
import Link from "next/link";
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
import type { FaqInput } from "@/lib/seo";
import { getCategoryStyle } from "@/lib/category-colors";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { TrustSection } from "@/components/tool/TrustSection";
import { ToolFaqAccordion } from "@/components/tool/ToolFaqAccordion";
import { getTool } from "@/lib/tools";
import { getCrossSellTools } from "@/lib/cross-sell";

const tool = getTool("/merge-pdf")!;

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
        "group relative flex flex-col rounded-xl border bg-white dark:bg-slate-900 shadow-sm cursor-grab active:cursor-grabbing touch-none",
        error && "border-destructive/40"
      )}
    >
      <div
        className={cn(
          "relative aspect-[3/4] rounded-t-xl overflow-hidden",
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

      <div className="p-2.5 min-w-0">
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

interface MergePdfClientProps {
  faqs: FaqInput[];
}

export function MergePdfClient({ faqs }: MergePdfClientProps) {
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
    setFiles((prev) => [...prev, ...newFiles]);
    setMergedPdf(null);

    newFiles.forEach((file) => {
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

  return (
    <div className="flex-1 py-8 md:py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <Link href="/" className="flex items-center gap-2 mb-6 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        {processing ? (
          // Processing takes over the full workspace - no competing
          // secondary content while a merge is in flight.
          <div className="border rounded-2xl bg-white dark:bg-slate-900 py-16 px-6 max-w-md mx-auto">
            <ProcessingState progress={progress} onCancel={cancel} label="Merging PDFs..." />
          </div>
        ) : mergedPdf ? (
          <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 md:p-10 max-w-xl mx-auto">
            <ResultState
              resultFilename="merged.pdf"
              fileSize={formatFileSize(mergedPdf.size)}
              onDownload={downloadMergedPdf}
              downloadLabel="Download PDF"
              onStartOver={clearAll}
              autoDownloadedRef={autoDownloadRef}
            />
          </div>
        ) : files.length === 0 ? (
          // EMPTY STATE — one primary action, nothing else competing with
          // it. No sidebar here: a second "Merge PDF / select or drop your
          // files" panel next to the upload zone would just repeat what
          // the upload zone itself already says.
          <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 md:p-10 max-w-xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-5", style.bgClass)}>
                <ToolIcon className={cn("h-7 w-7", style.iconClass)} aria-hidden />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Merge PDF</h1>
              <p className="text-muted-foreground max-w-sm mb-8">
                Combine PDFs in the order you want.
              </p>
              <div className="w-full">
                <FileUpload
                  accept={{ "application/pdf": [".pdf"] }}
                  multiple
                  onFilesSelected={handleFilesSelected}
                  primaryLabel="Select PDF files"
                  secondaryLabel="or drop PDFs here"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_320px] gap-6 items-start">
            {/* WORKSPACE — the wide canvas where documents live */}
            <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 md:p-8">
              <>
                {files.length > 1 && (
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                      <p className="text-sm text-muted-foreground">Drag to reorder</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => sortFiles("asc")}>
                          <ArrowDownAZ className="h-3.5 w-3.5" />
                          A–Z
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => sortFiles("desc")}>
                          <ArrowUpZA className="h-3.5 w-3.5" />
                          Z–A
                        </Button>
                      </div>
                    </div>
                  )}

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={fileIds} strategy={verticalListSortingStrategy}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {files.map((file, index) => (
                          <SortableFileCard
                            key={file.name + index}
                            file={file}
                            index={index}
                            isLast={index === files.length - 1}
                            pageCount={pageCounts.get(file)}
                            thumbnail={thumbnails.get(file)}
                            rotation={rotations.get(file) ?? 0}
                            error={fileErrors.get(file)}
                            isDuplicate={duplicateIndices.has(index)}
                            removeFile={removeFile}
                            moveFile={moveFile}
                            rotateFile={rotateFile}
                          />
                        ))}

                        {/* "+" tile - add more files, integrated into the
                           workspace grid as another document slot rather
                           than a full-width bar below it. */}
                        <div>
                          <input
                            ref={addMoreInputRef}
                            type="file"
                            accept="application/pdf"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              const selected = Array.from(event.target.files ?? []);
                              if (selected.length > 0) handleFilesSelected(selected);
                              event.target.value = "";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => addMoreInputRef.current?.click()}
                            disabled={processing}
                            aria-label="Add more files"
                            className="flex flex-col items-center justify-center gap-2 aspect-[3/4] w-full rounded-xl border-2 border-dashed text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
                          >
                            <Plus className="h-6 w-6" aria-hidden />
                            <span className="text-sm font-medium">Add files</span>
                          </button>
                        </div>
                      </div>
                    </SortableContext>
                    <DragOverlay>
                      {activeId ? (
                        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-xl border w-40">
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                          <p className="text-sm font-medium truncate">
                            {files.find((_, i) => files[i].name + i === activeId)?.name}
                          </p>
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                </>
            </div>

            {/* SIDEBAR — tool identity, status, and the one primary action */}
            <aside className="border rounded-2xl bg-white dark:bg-slate-900 p-5 md:sticky md:top-24 space-y-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", style.bgClass)}>
                  <ToolIcon className={cn("h-5 w-5", style.iconClass)} aria-hidden />
                </div>
                <h2 className="text-lg font-semibold">Merge PDF</h2>
              </div>

              <>
                  <p className="flex items-center gap-2 text-sm" aria-live="polite">
                    {!failed && canMerge && (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 shrink-0" aria-hidden />
                    )}
                    <span className="text-muted-foreground">
                      {files.length} file{files.length === 1 ? "" : "s"}
                      {totalPages !== null && ` · ${totalPages} page${totalPages === 1 ? "" : "s"}`}
                      {` · ${totalSizeMb} MB`}
                    </span>
                  </p>

                  {isLargeMerge && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                      <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" aria-hidden />
                      <p className="text-xs text-blue-900 dark:text-blue-200">
                        Large merge — this may take a little longer than usual.
                      </p>
                    </div>
                  )}
                  {hasMixedPageSizes && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                      <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" aria-hidden />
                      <p className="text-xs text-blue-900 dark:text-blue-200">
                        Mixed page sizes — each page keeps its original size.
                      </p>
                    </div>
                  )}
                  {hasBlockingError && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden />
                      <p className="text-xs text-destructive">
                        Remove or fix the marked file{fileErrors.size === 1 ? "" : "s"} before merging.
                      </p>
                    </div>
                  )}
                  {failed && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden />
                      <p className="text-xs text-destructive">Merge failed. Please try again.</p>
                    </div>
                  )}
                  {!failed && files.length === 1 && (
                    <p className="text-xs text-muted-foreground">Add one more file to merge</p>
                  )}

                  <div className="space-y-2 pt-1">
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={mergePDFs}
                      disabled={failed ? false : !canMerge}
                    >
                      {failed ? "Try Again" : `Merge ${files.length} PDF${files.length === 1 ? "" : "s"}`}
                    </Button>
                    <Button variant="outline" className="w-full" onClick={clearAll}>
                      Clear All
                    </Button>
                  </div>
                </>
            </aside>
          </div>
        )}

        {mergedPdf && (
          <div className="max-w-xl mx-auto">
            <RelatedTools title="Continue to..." tools={getCrossSellTools("merge-pdf")} />
            <TrustSection />
          </div>
        )}

        <div className="max-w-6xl">
          <ToolFaqAccordion faqs={faqs} />
        </div>
      </div>
    </div>
  );
}
