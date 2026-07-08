"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { loadPdfjs } from "@/lib/pdfjs";
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
}

function SortablePageThumb({ page, position }: SortablePageThumbProps) {
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
  const { processing, progress, run } = useProcessingTask();

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
      const pdfjsLib = await loadPdfjs();
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const thumbs: PageThumb[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
        thumbs.push({
          id: `page-${i}`,
          originalIndex: i - 1,
          dataUrl: canvas.toDataURL("image/jpeg", 0.7),
        });
      }

      setPages(thumbs);
    } catch (error) {
      console.error("Error loading PDF pages:", error);
      toast.error("Failed to load PDF", {
        description: "Please try again with a valid PDF file",
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

  const rearrangePages = () => {
    if (!file || pages.length === 0) return;

    run(
      async (setProgress) => {
        setRearrangedPdf(null);
        const { PDFDocument } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const newOrder = pages.map((p) => p.originalIndex);

        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdf, newOrder);
        copiedPages.forEach((page, index) => {
          newPdf.addPage(page);
          setProgress(((index + 1) / copiedPages.length) * 100);
        });

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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
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
                        <SortablePageThumb key={page.id} page={page} position={index + 1} />
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

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={rearrangePages} disabled={processing}>
                    Rearrange PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setPages([]);
                      setRearrangedPdf(null);
                    }}
                    disabled={processing}
                  >
                    Clear
                  </Button>
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
            <CardTitle className="text-xl md:text-2xl">Frequently Asked Questions</CardTitle>
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
    </main>
  );
}
