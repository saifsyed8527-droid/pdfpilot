"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  GripVertical,
  Trash2,
  ArrowLeft,
  Plus,
  ArrowDownAZ,
  ArrowUpZA,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { sortFilesByName } from "@/lib/file-sort";
import { formatFileSize } from "@/lib/utils";
import type { FaqInput } from "@/lib/seo";
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
import { ToolHeader } from "@/components/tool/ToolHeader";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { TrustSection } from "@/components/tool/TrustSection";
import { ToolFaqAccordion } from "@/components/tool/ToolFaqAccordion";
import { getTool } from "@/lib/tools";
import { getCrossSellTools } from "@/lib/cross-sell";

const tool = getTool("/jpg-to-pdf")!;

interface SortableImageItemProps {
  file: File;
  index: number;
  isLast: boolean;
  thumbnail: string;
  removeFile: (index: number) => void;
  moveFile: (index: number, direction: -1 | 1) => void;
}

function SortableImageItem({ file, index, isLast, thumbnail, removeFile, moveFile }: SortableImageItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: file.name + index,
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
      className="group flex items-center gap-3 p-3 bg-card border rounded-lg shadow-sm"
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

      <div className="relative h-14 w-14 shrink-0 rounded border overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- real client-rendered object URL, not an optimizable remote asset */}
        <img src={thumbnail} alt="" className="h-full w-full object-cover" />
        <span
          className="absolute top-1 left-1 flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shadow"
          aria-hidden="true"
        >
          {index + 1}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
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

interface JpgToPdfClientProps {
  faqs: FaqInput[];
}

export function JpgToPdfClient({ faqs }: JpgToPdfClientProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [convertedPdf, setConvertedPdf] = useState<Blob | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const { processing, progress, run } = useProcessingTask();
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const autoDownloadRef = useRef<boolean>(false);

  // Object URLs are created once per File instance and only torn down when
  // that exact file is no longer selected - keyed by File identity in a ref,
  // not derived via useMemo(() => ..., [files]). Reordering/sorting replaces
  // the `files` array's own reference on every call but keeps the same File
  // objects, so a useMemo keyed on the whole array would otherwise redo
  // createObjectURL for every file (and revoke+leak the old URLs) on a pure
  // reorder that touched none of their actual bytes.
  const thumbnailsRef = useRef<Map<File, string>>(new Map());
  for (const file of files) {
    if (!thumbnailsRef.current.has(file)) {
      thumbnailsRef.current.set(file, URL.createObjectURL(file));
    }
  }
  useEffect(() => {
    const stillSelected = new Set(files);
    for (const [file, url] of thumbnailsRef.current) {
      if (!stillSelected.has(file)) {
        URL.revokeObjectURL(url);
        thumbnailsRef.current.delete(file);
      }
    }
  }, [files]);
  useEffect(() => {
    const map = thumbnailsRef.current;
    return () => {
      for (const url of map.values()) URL.revokeObjectURL(url);
    };
  }, []);
  const thumbnails = thumbnailsRef.current;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragEndEvent) => setActiveId(event.active.id);

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

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setConvertedPdf(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const sortFiles = (direction: "asc" | "desc") => {
    setFiles((prev) => sortFilesByName(prev, direction));
  };

  const convertToPDF = () => {
    if (files.length === 0) return;

    run(
      async (setProgress, isCancelled) => {
        setConvertedPdf(null);
        autoDownloadRef.current = false;
        const { PDFDocument } = await import("pdf-lib");
        const pdfDoc = await PDFDocument.create();
        const totalFiles = files.length;

        // Reading file bytes is pure I/O and each file is independent, so
        // every file is read concurrently instead of one at a time - this
        // was previously a synchronous per-file `await file.arrayBuffer()`
        // inside the loop, serializing I/O wait time that has no reason to
        // be serial. The pdf-lib document mutations that follow (embed +
        // addPage + drawImage) still run strictly in array order in a
        // single loop, so page order in the output is unchanged.
        const buffers = await Promise.all(files.map((file) => file.arrayBuffer()));

        for (let i = 0; i < totalFiles; i++) {
          if (isCancelled()) return;
          const file = files[i];
          const arrayBuffer = buffers[i];
          const image =
            file.type === "image/png"
              ? await pdfDoc.embedPng(arrayBuffer)
              : await pdfDoc.embedJpg(arrayBuffer);

          const page = pdfDoc.addPage([image.width, image.height]);
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

          setProgress(((i + 1) / totalFiles) * 100);
        }

        if (isCancelled()) return;

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setConvertedPdf(blob);
      },
      {
        successMessage: "Images converted to PDF!",
        toolName: "jpg-to-pdf",
        errorTitle: "Failed to convert images",
        onError: (error) => {
          console.error("Error converting images:", error);
          return "Please try again with valid image files";
        },
      }
    );
  };

  const downloadConvertedPdf = () => {
    if (!convertedPdf) return;
    downloadBlob(convertedPdf, "images-to-pdf.pdf");
  };

  const fileIds = useMemo(() => files.map((file, i) => file.name + i), [files]);
  const totalSizeMb = useMemo(
    () => (files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2),
    [files]
  );

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
            {files.length === 0 && !convertedPdf && (
              <FileUpload
                accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] }}
                multiple
                onFilesSelected={handleFilesSelected}
              />
            )}

            {files.length > 0 && !convertedPdf && (
              <>
                {files.length > 1 && (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm text-muted-foreground">
                      {files.length} images · {totalSizeMb} MB · drag to reorder
                    </p>
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
                        <SortableImageItem
                          key={file.name + index}
                          file={file}
                          index={index}
                          isLast={index === files.length - 1}
                          thumbnail={thumbnails.get(file) ?? ""}
                          removeFile={removeFile}
                          moveFile={moveFile}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {activeId ? (
                      <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-xl border">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                        <p className="font-medium truncate">
                          {files.find((_, i) => files[i].name + i === activeId)?.name}
                        </p>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>

                <div>
                  <input
                    ref={addMoreInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
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
                    Add more images
                  </Button>
                </div>

                {processing ? (
                  <ProcessingState progress={progress} label="Converting images to PDF..." />
                ) : (
                  <div className="flex gap-4 flex-wrap">
                    <Button size="lg" onClick={convertToPDF} disabled={files.length === 0}>
                      Convert {files.length} Image{files.length === 1 ? "" : "s"} to PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFiles([]);
                        setConvertedPdf(null);
                      }}
                      disabled={processing}
                    >
                      Clear All
                    </Button>
                  </div>
                )}
              </>
            )}

            {convertedPdf && (
              <ResultState
                resultFilename="images-to-pdf.pdf"
                fileSize={formatFileSize(convertedPdf.size)}
                onDownload={downloadConvertedPdf}
                downloadLabel="Download PDF"
                onStartOver={() => {
                  setFiles([]);
                  setConvertedPdf(null);
                }}
                autoDownloadedRef={autoDownloadRef}
              />
            )}
          </CardContent>
        </Card>

        {convertedPdf && (
          <>
            <RelatedTools tools={getCrossSellTools("jpg-to-pdf")} />
            <TrustSection />
          </>
        )}

        <ToolFaqAccordion faqs={faqs} />
      </div>
    </div>
  );
}
