"use client";

import { useState, useMemo } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GripVertical, Trash2, Download, FileText, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
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

interface SortableFileItemProps {
  file: File;
  index: number;
  removeFile: (index: number) => void;
}

function SortableFileItem({ file, index, removeFile }: SortableFileItemProps) {
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
      className="flex items-center gap-4 p-4 bg-muted rounded-lg"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <FileText className="h-5 w-5 text-primary" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{file.name}</p>
        <p className="text-sm text-muted-foreground">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
      <Button
        variant="destructive"
        size="icon"
        onClick={() => removeFile(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface MergePdfClientProps {
  faqs: FaqInput[];
}

export function MergePdfClient({ faqs }: MergePdfClientProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mergedPdf, setMergedPdf] = useState<Blob | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

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
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const mergePDFs = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setProgress(0);
    setMergedPdf(null);

    try {
      const mergedPdfDoc = await PDFDocument.create();
      const totalFiles = files.length;

      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdfDoc.copyPages(pdf, pdf.getPageIndices());

        copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
        setProgress(((i + 1) / totalFiles) * 100);
      }

      const pdfBytes = await mergedPdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      setMergedPdf(blob);

      toast.success("PDF merged successfully!", {
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      });
    } catch (error) {
      console.error("Error merging PDFs:", error);
      toast.error("Failed to merge PDF", {
        description: "Please try again with valid PDF files",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
    } finally {
      setProcessing(false);
    }
  };

  const downloadMergedPdf = () => {
    if (!mergedPdf) return;
    const url = URL.createObjectURL(mergedPdf);
    const a = document.createElement("a");
    a.href = url;
    a.download = "merged.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fileIds = useMemo(() => files.map((file, i) => file.name + i), [files]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl">Merge PDF</CardTitle>
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
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={fileIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {files.map((file, index) => (
                        <SortableFileItem
                          key={file.name + index}
                          file={file}
                          index={index}
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

                <FileUpload
                  accept={{ "application/pdf": [".pdf"] }}
                  multiple
                  onFilesSelected={handleFilesSelected}
                />

                {processing && <Progress value={progress} className="h-2" />}

                <div className="flex gap-4 flex-wrap">
                  <Button
                    size="lg"
                    onClick={mergePDFs}
                    disabled={processing || files.length < 2}
                  >
                    Merge PDFs
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFiles([]);
                      setMergedPdf(null);
                    }}
                    disabled={processing}
                  >
                    Clear All
                  </Button>
                </div>
              </>
            )}

            {mergedPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">PDF merged successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadMergedPdf}>
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFiles([]);
                      setMergedPdf(null);
                    }}
                  >
                    Merge Another PDF
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
      </div>
    </main>
  );
}
