"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Download, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import {
  classifyPdfRenderError,
  PDF_RENDER_ERROR_MESSAGE,
  renderPdfPages,
} from "@/lib/engines/pdf-render-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DragEndEvent, UniqueIdentifier } from "@dnd-kit/core";

interface PageThumb {
  id: string;
  originalIndex: number;
  dataUrl: string;
}

interface SortablePageThumbProps {
  page: PageThumb;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
}

function SortablePageThumb({ page, position, isFirst, isLast, onMove }: SortablePageThumbProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

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
      className="relative border rounded-lg overflow-hidden bg-muted cursor-grab active:cursor-grabbing"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={page.dataUrl} alt={`Page ${page.originalIndex + 1}`} className="w-full" />
      <div className="absolute top-2 left-2 bg-background/90 text-xs font-medium px-2 py-1 rounded">
        {position}
      </div>
      {/* Mobile reorder - explicit earlier/later buttons instead of drag,
          which is measurably harder on touch (no hover, imprecise contact
          area, competes with page-scroll) - same rationale as Merge PDF's
          file-list mobile fallback, adapted for a wrapping thumbnail grid:
          earlier/later in document order rather than up/down, since "down"
          has no consistent meaning once thumbnails wrap to a new row. */}
      <div className="absolute bottom-2 right-2 flex md:hidden gap-1">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onMove(-1)}
          disabled={isFirst}
          aria-label={`Move page ${page.originalIndex + 1} earlier`}
          className="h-7 w-7 flex items-center justify-center rounded bg-background/90 border border-border disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onMove(1)}
          disabled={isLast}
          aria-label={`Move page ${page.originalIndex + 1} later`}
          className="h-7 w-7 flex items-center justify-center rounded bg-background/90 border border-border disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface RearrangePagesClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function RearrangePagesClient({ faqs, related }: RearrangePagesClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [rearrangedPdf, setRearrangedPdf] = useState<Blob | null>(null);
  const { processing, progress, failed, run, cancel } = useProcessingTask();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const pdfFile = newFiles[0];
    setFile(pdfFile);
    setRearrangedPdf(null);
    setPages([]);
    setLoadingThumbnails(true);

    try {
      const rendered = await renderPdfPages(pdfFile, 0.35);
      setPages(
        rendered.map((r) => ({
          id: `page-${r.pageNumber}`,
          originalIndex: r.pageNumber - 1,
          dataUrl: r.canvas.toDataURL("image/jpeg", 0.7),
        }))
      );
    } catch (error) {
      console.error("Error loading PDF pages:", error);
      toast.error("Failed to load PDF", {
        description: PDF_RENDER_ERROR_MESSAGE[classifyPdfRenderError(error)],
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      setFile(null);
    } finally {
      setLoadingThumbnails(false);
    }
  };

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPages((items) => {
        const oldIndex = items.findIndex((p) => p.id === active.id);
        const newIndex = items.findIndex((p) => p.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  };

  const movePage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    setPages((items) => {
      if (target < 0 || target >= items.length) return items;
      return arrayMove(items, index, target);
    });
  };

  const rearrangePages = () => {
    if (!file || pages.length === 0) return;

    run(
      async (setProgress, isCancelled) => {
        setRearrangedPdf(null);
        const { PDFDocument } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const newOrder = pages.map((p) => p.originalIndex);

        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdf, newOrder);
        for (let index = 0; index < copiedPages.length; index++) {
          if (isCancelled()) return;
          newPdf.addPage(copiedPages[index]);
          setProgress(((index + 1) / copiedPages.length) * 100);
        }

        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setRearrangedPdf(blob);
      },
      {
        successMessage: "Pages rearranged successfully!",
        toolName: "rearrange-pages",
        errorTitle: "Failed to rearrange pages",
        onError: (error) => {
          console.error("Error rearranging pages:", error);
          return "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!rearrangedPdf) return;
    downloadBlob(rearrangedPdf, "rearranged.pdf");
  };

  const activePage = pages.find((p) => p.id === activeId);

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>Rearrange Pages</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !rearrangedPdf && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {loadingThumbnails && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                <p role="status">Loading pages…</p>
              </div>
            )}

            {file && !loadingThumbnails && pages.length > 0 && !rearrangedPdf && (
              <>
                <p className="text-sm text-muted-foreground">
                  Drag pages into the order you want, then rearrange.
                </p>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {pages.map((page, index) => (
                        <SortablePageThumb
                          key={page.id}
                          page={page}
                          position={index + 1}
                          isFirst={index === 0}
                          isLast={index === pages.length - 1}
                          onMove={(direction) => movePage(index, direction)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {activePage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activePage.dataUrl}
                        alt=""
                        className="w-full rounded-lg shadow-xl border opacity-90"
                      />
                    ) : null}
                  </DragOverlay>
                </DndContext>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Rearranging pages" />
                )}

                {failed && !processing && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Rearrange failed</p>
                      <p className="text-sm text-muted-foreground">Please try again with a valid PDF file.</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 flex-wrap">
                  {processing ? (
                    <Button variant="outline" size="lg" onClick={cancel}>
                      Cancel
                    </Button>
                  ) : (
                    <>
                      <Button size="lg" onClick={rearrangePages}>
                        {failed ? "Try Again" : "Rearrange PDF"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFile(null);
                          setPages([]);
                          setRearrangedPdf(null);
                        }}
                      >
                        Clear
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {rearrangedPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Pages rearranged successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setPages([]);
                      setRearrangedPdf(null);
                    }}
                  >
                    Rearrange Another PDF
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
