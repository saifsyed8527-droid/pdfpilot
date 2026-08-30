"use client";

import { useState, useMemo, useRef } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { formatFileSize } from "@/lib/utils";
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
import { ToolHeader } from "@/components/tool/ToolHeader";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { TrustSection } from "@/components/tool/TrustSection";
import { ToolFaqAccordion } from "@/components/tool/ToolFaqAccordion";
import { getTool } from "@/lib/tools";
import { getCrossSellTools } from "@/lib/cross-sell";

const tool = getTool("/merge-pdf")!;

type FileError = "password" | "unreadable";

interface SortableFileItemProps {
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

function SortableFileItem({
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
}: SortableFileItemProps) {
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
      className={`group flex items-center gap-3 p-3 bg-card border rounded-lg shadow-sm ${
        error ? "border-destructive/40" : ""
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="hidden md:flex items-center justify-center h-10 w-8 shrink-0 cursor-grab active:cursor-grabbing touch-none"
        aria-label={`Reorder ${file.name}`}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="flex md:hidden flex-col shrink-0">
        <button
          type="button"
          onClick={() => moveFile(index, -1)}
          disabled={index === 0}
          aria-label={`Move ${file.name} up`}
          className="h-6 w-8 flex items-center justify-center text-muted-foreground disabled:opacity-30 active:text-primary"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => moveFile(index, 1)}
          disabled={isLast}
          aria-label={`Move ${file.name} down`}
          className="h-6 w-8 flex items-center justify-center text-muted-foreground disabled:opacity-30 active:text-primary"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div
        className={`relative h-16 w-12 shrink-0 rounded border overflow-hidden ${
          error ? "bg-destructive/5 border-destructive/40" : "bg-muted"
        }`}
      >
        {error === "password" ? (
          <div className="h-full w-full flex items-center justify-center">
            <Lock className="h-5 w-5 text-destructive" aria-hidden />
          </div>
        ) : thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot, not an optimizable remote asset
          <img
            src={thumbnail}
            alt=""
            className="h-full w-full object-cover transition-transform duration-200"
            style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
          />
        ) : thumbnail === null ? (
          <div className="h-full w-full flex items-center justify-center">
            <FileText className={`h-5 w-5 ${error ? "text-destructive" : "text-muted-foreground"}`} aria-hidden />
          </div>
        ) : (
          <div className="h-full w-full animate-pulse bg-muted-foreground/10" aria-hidden />
        )}
        <span
          className="absolute top-1 left-1 flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shadow"
          aria-hidden="true"
        >
          {index + 1}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" title={file.name}>{file.name}</p>
        {error === "password" ? (
          <p className="text-sm text-destructive">Password protected — remove the password first</p>
        ) : error === "unreadable" ? (
          <p className="text-sm text-destructive">Couldn&apos;t read this file</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {pageCount === undefined ? "…" : `${pageCount} page${pageCount === 1 ? "" : "s"}`}
            {" · "}
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
        {isDuplicate && !error && (
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
            Same name and size as another file above — likely a duplicate
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 has-[:focus-visible]:opacity-100 transition-opacity">
        {!error && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => rotateFile(index)}
            aria-label={`Rotate ${file.name}`}
            title="Rotate 90°"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="destructive"
          size="icon"
          onClick={() => removeFile(index)}
          aria-label={`Remove ${file.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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

  return (
    <div className="flex-1 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <ToolHeader tool={tool} />
          </CardHeader>
          <CardContent className="space-y-6">
            {files.length === 0 && !mergedPdf && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple
                onFilesSelected={handleFilesSelected}
              />
            )}

            {files.length > 0 && !mergedPdf && (
              <>
                {files.length > 1 && (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
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
                    <div className="space-y-2 p-3 rounded-xl bg-muted/40 border border-dashed">
                      {files.map((file, index) => (
                        <SortableFileItem
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
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {activeId ? (
                      <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-xl border">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                        <FileText className="h-5 w-5 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {files.find((_, i) => files[i].name + i === activeId)?.name}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>

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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addMoreInputRef.current?.click()}
                    className="w-full border-dashed"
                    disabled={processing}
                  >
                    <Plus className="h-4 w-4 mr-2" aria-hidden />
                    Add more files
                  </Button>
                </div>

                {processing ? (
                  <ProcessingState progress={progress} onCancel={cancel} label="Merging PDFs..." />
                ) : (
                  <div className="p-4 rounded-xl bg-muted/60 space-y-4">
                    <p className="flex items-center gap-2 text-sm" aria-live="polite">
                      {!failed && files.length >= 2 && !hasBlockingError && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 shrink-0" aria-hidden />
                      )}
                      <span className="text-muted-foreground">
                        {files.length} file{files.length === 1 ? "" : "s"}
                        {totalPages !== null && ` · ${totalPages} page${totalPages === 1 ? "" : "s"}`}
                        {` · ${totalSizeMb} MB`}
                      </span>
                    </p>

                    {isLargeMerge && (
                      <p className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                        Large merge — this may take a little longer than usual.
                      </p>
                    )}
                    {hasMixedPageSizes && (
                      <p className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                        These files have different page sizes — the merged PDF will keep each
                        page&apos;s original size rather than resizing them to match.
                      </p>
                    )}

                    {hasBlockingError && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden />
                        <div>
                          <p className="text-sm font-medium text-destructive">Can&apos;t merge yet</p>
                          <p className="text-sm text-muted-foreground">
                            Remove or fix the file{fileErrors.size === 1 ? "" : "s"} marked above before merging.
                          </p>
                        </div>
                      </div>
                    )}

                    {failed && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden />
                        <div>
                          <p className="text-sm font-medium text-destructive">Merge failed</p>
                          <p className="text-sm text-muted-foreground">
                            Please try again with valid PDF files.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 flex-wrap">
                      {failed ? (
                        <>
                          <Button size="lg" onClick={mergePDFs}>
                            Try Again
                          </Button>
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => {
                              setFiles([]);
                              setMergedPdf(null);
                            }}
                          >
                            Clear All
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="lg"
                            onClick={mergePDFs}
                            disabled={files.length < 2 || hasBlockingError}
                          >
                            Merge {files.length} PDF{files.length === 1 ? "" : "s"}
                          </Button>
                          {files.length === 1 && (
                            <p className="text-sm text-muted-foreground">Add one more file to merge</p>
                          )}
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => {
                              setFiles([]);
                              setMergedPdf(null);
                            }}
                          >
                            Clear All
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {mergedPdf && (
              <ResultState
                resultFilename="merged.pdf"
                fileSize={formatFileSize(mergedPdf.size)}
                onDownload={downloadMergedPdf}
                downloadLabel="Download PDF"
                onStartOver={() => { setFiles([]); setMergedPdf(null); }}
                autoDownloadedRef={autoDownloadRef}
              />
            )}
          </CardContent>
        </Card>

        {mergedPdf && (
          <>
            <RelatedTools tools={getCrossSellTools("merge-pdf")} />
            <TrustSection />
          </>
        )}

        <ToolFaqAccordion faqs={faqs} />
      </div>
    </div>
  );
}
