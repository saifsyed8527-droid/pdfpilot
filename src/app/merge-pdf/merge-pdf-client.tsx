"use client";

import { useState, useMemo, useRef } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GripVertical, Trash2, Download, FileText, ArrowLeft, Plus, AlertCircle } from "lucide-react";
import Link from "next/link";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getPdfPageCount } from "@/lib/engines/pdf-engine";
import { renderFirstPageThumbnail } from "@/lib/engines/pdf-render-engine";
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
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface SortableFileItemProps {
  file: File;
  index: number;
  /** undefined while the real count is still being read from the file -
   *  never a guessed number, so the row shows "…" rather than a value
   *  that might be wrong for a moment. */
  pageCount: number | undefined;
  /** undefined while rendering, null if rendering failed (falls back to a
   *  generic document icon) - a real page-1 render, never a placeholder
   *  presented as if it were the file's actual content. */
  thumbnail: string | undefined | null;
  removeFile: (index: number) => void;
}

function SortableFileItem({ file, index, pageCount, thumbnail, removeFile }: SortableFileItemProps) {
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
      className="group flex items-center gap-3 p-3 bg-card border rounded-lg shadow-sm"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center h-10 w-8 shrink-0 cursor-grab active:cursor-grabbing touch-none"
        aria-label={`Reorder ${file.name}`}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Real page-1 render, not a generic file icon - the single biggest
          verification signal a document-assembly workspace can offer:
          "is this actually the right file, right side up." Order badge
          overlays the thumbnail's corner, matching PageThumbnailGrid's
          existing per-page badge pattern elsewhere in the product. */}
      <div className="relative h-16 w-12 shrink-0 rounded border bg-muted overflow-hidden">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot, not an optimizable remote asset
          <img src={thumbnail} alt="" className="h-full w-full object-cover" />
        ) : thumbnail === null ? (
          <div className="h-full w-full flex items-center justify-center">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
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
        <p className="font-medium truncate">{file.name}</p>
        <p className="text-sm text-muted-foreground">
          {pageCount === undefined ? "…" : `${pageCount} page${pageCount === 1 ? "" : "s"}`}
          {" · "}
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>

      <Button
        variant="destructive"
        size="icon"
        onClick={() => removeFile(index)}
        aria-label={`Remove ${file.name}`}
        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface MergePdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function MergePdfClient({ faqs, related }: MergePdfClientProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [mergedPdf, setMergedPdf] = useState<Blob | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  // Keyed by File reference (stable across reorders, since reordering only
  // rearranges the array) rather than by name+index (unstable across
  // reorders/removals) - real counts only, never guessed.
  const [pageCounts, setPageCounts] = useState<Map<File, number>>(new Map());
  // undefined = still rendering, null = render attempted and failed (falls
  // back to a generic icon rather than hiding the row or showing nothing).
  const [thumbnails, setThumbnails] = useState<Map<File, string | null>>(new Map());
  const { processing, progress, failed, run, cancel } = useProcessingTask();
  const addMoreInputRef = useRef<HTMLInputElement>(null);

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

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setMergedPdf(null);

    newFiles.forEach((file) => {
      getPdfPageCount(file)
        .then((count) => {
          setPageCounts((prev) => new Map(prev).set(file, count));
        })
        .catch(() => {
          // Leave uncounted rather than showing a guessed number - the
          // merge attempt itself will surface the real error.
        });

      renderFirstPageThumbnail(file)
        .then((dataUrl) => {
          setThumbnails((prev) => new Map(prev).set(file, dataUrl));
        })
        .catch(() => {
          // Real failure (e.g. a corrupt or password-protected file) -
          // fall back to the generic icon rather than leaving the row
          // stuck on the loading skeleton forever.
          setThumbnails((prev) => new Map(prev).set(file, null));
        });
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const mergePDFs = () => {
    if (files.length === 0) return;

    run(
      async (setProgress, isCancelled) => {
        setMergedPdf(null);
        const { PDFDocument } = await import("pdf-lib");
        const mergedPdfDoc = await PDFDocument.create();
        const totalFiles = files.length;

        for (let i = 0; i < totalFiles; i++) {
          if (isCancelled()) return;
          const file = files[i];
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await PDFDocument.load(arrayBuffer);
          const copiedPages = await mergedPdfDoc.copyPages(pdf, pdf.getPageIndices());

          copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
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

  // Only shown once every file's real count has resolved - never a partial
  // or estimated sum.
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

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
              Document Assembly Workspace
            </p>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>Merge PDF</h1>
            </CardTitle>
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
                {/* Editing area - visually its own zone, separate from the
                    summary/action zone below, so the eye reads "this is
                    where I work" vs. "this is where I commit." */}
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
                          pageCount={pageCounts.get(file)}
                          thumbnail={thumbnails.get(file)}
                          removeFile={removeFile}
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

                {/* Verification + commit zone - visually distinct from the
                    editing area above, so "reviewing what I'm about to do"
                    reads as a separate step from "arranging my files." */}
                <div className="p-4 rounded-xl bg-muted/60 space-y-4">
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {files.length} file{files.length === 1 ? "" : "s"}
                    {totalPages !== null && ` · ${totalPages} page${totalPages === 1 ? "" : "s"}`}
                    {` · ${totalSizeMb} MB`}
                  </p>

                  {processing && (
                    <Progress value={progress} className="h-2" aria-label="Merging PDFs" />
                  )}

                  {failed && !processing && (
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
                    {processing ? (
                      <Button variant="outline" size="lg" onClick={cancel}>
                        Cancel
                      </Button>
                    ) : failed ? (
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
                        <Button size="lg" onClick={mergePDFs} disabled={files.length < 2}>
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
              </>
            )}

            {mergedPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Your file is ready</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadMergedPdf}>
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setFiles([]);
                      setMergedPdf(null);
                    }}
                  >
                    Process another file
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle asChild className="text-xl md:text-2xl"><h2>Frequently Asked Questions</h2></CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="font-semibold mb-1">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <ToolRelatedContent items={related} />
      </div>
    </div>
  );
}
