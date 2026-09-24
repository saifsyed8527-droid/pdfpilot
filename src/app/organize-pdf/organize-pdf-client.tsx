"use client";

import { UiText } from "@/components/i18n/UiText";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown01,
  ArrowLeftRight,
  FilePlus2,
  FileText,
  GripVertical,
  Loader2,
  RotateCw,
  Shuffle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PdfAddButton, PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import {
  classifyPdfRenderError,
  PDF_RENDER_ERROR_MESSAGE,
  renderPdfPages,
} from "@/lib/engines/pdf-render-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import { cn, formatFileSize } from "@/lib/utils";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

type SourceFile = {
  id: string;
  file: File;
  pageCount: number;
};

type PageItem = {
  id: string;
  kind: "pdf" | "blank";
  fileId?: string;
  fileIndex?: number;
  originalPageIndex?: number;
  pageNumberLabel: string;
  thumbnail?: string;
  rotation: number;
};

type Result = {
  blob: Blob;
  filename: string;
};

const A4_SIZE: [number, number] = [595.28, 841.89];

interface OrganizePdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

function SortablePageCard({
  item,
  index,
  disabled,
  onRotate,
  onRemove,
  onInsertBlankBefore,
}: {
  item: PageItem;
  index: number;
  disabled: boolean;
  onRotate: () => void;
  onRemove: () => void;
  onInsertBlankBefore: () => void;
}) {
  const sortable = useSortable({ id: item.id, disabled });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.28 : 1,
    zIndex: sortable.isDragging ? 30 : "auto",
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        "group/card relative w-[188px] rounded-lg border-2 bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:bg-slate-900",
        item.kind === "blank" ? "border-slate-300" : "border-rose-200"
      )}
    >
      <button
        type="button"
        {...sortable.attributes}
        {...sortable.listeners}
        className="absolute left-2 top-2 z-10 rounded-full bg-white/95 p-1.5 text-slate-400 shadow-sm transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-slate-950"
        aria-label={`Drag page ${index + 1}`}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
        <button
          type="button"
          onClick={onRotate}
          disabled={disabled}
          className="rounded-full bg-white/95 p-1.5 text-red-600 shadow-sm transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 dark:bg-slate-950"
          aria-label={`Rotate page ${index + 1}`}
        >
          <RotateCw className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="rounded-full bg-white/95 p-1.5 text-slate-500 shadow-sm transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 dark:bg-slate-950"
          aria-label={`Remove page ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <button
        type="button"
        onClick={onInsertBlankBefore}
        disabled={disabled}
        className="absolute -left-5 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 text-red-600 shadow-md transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 group-hover/card:block group-focus-within/card:block dark:bg-slate-950"
        aria-label={`Add a blank page before page ${index + 1}`}
      >
        <FilePlus2 className="h-4 w-4" aria-hidden />
      </button>
      <div className="flex h-[220px] items-center justify-center overflow-hidden rounded-md bg-slate-50 dark:bg-slate-950">
        {item.kind === "blank" ? (
          <div className="flex h-[176px] w-[124px] flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-white text-xs font-semibold text-slate-400 dark:bg-slate-900">
            Blank
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt=""
            className="max-h-[196px] max-w-[136px] rounded bg-white shadow-sm transition-transform"
            style={item.rotation ? { transform: `rotate(${item.rotation}deg)` } : undefined}
          />
        )}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        <span>{index + 1}</span>
        {item.rotation > 0 && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600">{item.rotation}deg</span>}
      </div>
      <p className="mt-1 truncate text-xs text-slate-400">{item.pageNumberLabel}</p>
    </div>
  );
}

export function OrganizePdfClient({ faqs: _faqs, related: _related }: OrganizePdfClientProps) {
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, failed, run, cancel } = useProcessingTask();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const totalBytes = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);
  const pdfPages = pages.filter((item) => item.kind === "pdf").length;
  const blankPages = pages.length - pdfPages;
  const activePage = pages.find((item) => item.id === activeId);

  const addFiles = async (newFiles: File[]) => {
    const pdfFiles = newFiles.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (!pdfFiles.length) return;

    setLoading(true);
    setResult(null);
    autoDownloadRef.current = false;

    try {
      const nextFiles: SourceFile[] = [];
      const nextPages: PageItem[] = [];
      const baseFileIndex = files.length;

      for (let index = 0; index < pdfFiles.length; index++) {
        const file = pdfFiles[index];
        const fileId = `${Date.now()}-${baseFileIndex + index}-${file.name}`;
        const rendered = await renderPdfPages(file, { scale: 0.36 });
        nextFiles.push({ id: fileId, file, pageCount: rendered.length });
        for (const page of rendered) {
          nextPages.push({
            id: `${fileId}-page-${page.pageNumber}`,
            kind: "pdf",
            fileId,
            fileIndex: baseFileIndex + index,
            originalPageIndex: page.pageNumber - 1,
            pageNumberLabel: `${file.name} · page ${page.pageNumber}`,
            thumbnail: page.canvas.toDataURL("image/jpeg", 0.74),
            rotation: 0,
          });
        }
      }

      setFiles((current) => [...current, ...nextFiles]);
      setPages((current) => [...current, ...nextPages]);
    } catch (error) {
      console.error("Error loading PDF pages:", error);
      toast.error("Failed to load PDF", {
        description: PDF_RENDER_ERROR_MESSAGE[classifyPdfRenderError(error)],
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setFiles([]);
    setPages([]);
    setResult(null);
    autoDownloadRef.current = false;
  };

  const removePage = (id: string) => {
    setPages((current) => current.filter((item) => item.id !== id));
  };

  const rotatePage = (id: string) => {
    setPages((current) =>
      current.map((item) => (item.id === id ? { ...item, rotation: (item.rotation + 90) % 360 } : item))
    );
  };

  const insertBlankBefore = (index: number) => {
    const blank: PageItem = {
      id: `blank-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind: "blank",
      pageNumberLabel: "Blank page",
      rotation: 0,
    };
    setPages((current) => [...current.slice(0, index), blank, ...current.slice(index)]);
  };

  const insertBlankAtEnd = () => {
    insertBlankBefore(pages.length);
  };

  const sortByOriginalPage = () => {
    setPages((current) =>
      [...current].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "pdf" ? -1 : 1;
        if (a.kind === "blank" || b.kind === "blank") return 0;
        return (a.fileIndex ?? 0) - (b.fileIndex ?? 0) || (a.originalPageIndex ?? 0) - (b.originalPageIndex ?? 0);
      })
    );
  };

  const organizePdf = () => {
    if (!pages.length || !files.length) return;

    run(
      async (setProgress, isCancelled) => {
        setResult(null);
        autoDownloadRef.current = false;
        const { PDFDocument, degrees } = await import("pdf-lib");
        const sourceDocs = new Map<string, Awaited<ReturnType<typeof PDFDocument.load>>>();

        for (const source of files) {
          sourceDocs.set(source.id, await PDFDocument.load(await source.file.arrayBuffer()));
        }

        const output = await PDFDocument.create();
        for (let index = 0; index < pages.length; index++) {
          if (isCancelled()) return;
          const item = pages[index];
          if (item.kind === "blank") {
            const blank = output.addPage(A4_SIZE);
            if (item.rotation) blank.setRotation(degrees(item.rotation));
          } else if (item.fileId && typeof item.originalPageIndex === "number") {
            const source = sourceDocs.get(item.fileId);
            if (!source) throw new Error("One of the source PDFs is no longer available.");
            const [copy] = await output.copyPages(source, [item.originalPageIndex]);
            if (item.rotation) {
              const currentRotation = copy.getRotation().angle;
              copy.setRotation(degrees((currentRotation + item.rotation) % 360));
            }
            output.addPage(copy);
          }
          setProgress(((index + 1) / pages.length) * 100);
        }

        const bytes = await output.save();
        setResult({
          blob: new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
          filename: "organized.pdf",
        });
      },
      {
        successMessage: "PDF organized successfully!",
        toolName: "organize-pdf",
        errorTitle: "Failed to organize PDF",
        onError: (error) => {
          console.error("Error organizing PDF:", error);
          return error instanceof Error ? error.message : "Please try again with a valid PDF file.";
        },
      }
    );
  };

  const downloadResult = useCallback(() => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  }, [result]);

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="organize-pdf">
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={downloadResult}
          onStartOver={clearAll}
          autoDownloadedRef={autoDownloadRef}
          downloadLabel="Download file"
        />
      </PdfToolResultLayout>
    );
  }

  if (!files.length && !loading) {
    return (
      <PdfToolLanding
        title="Organize PDF"
        description="Sort, add, rotate, and remove PDF pages in one visual workspace."
        buttonLabel="Select PDF file"
        dropLabel="or drop PDFs here"
        limitLabel="Up to 100MB per PDF"
        accept={{ "application/pdf": [".pdf"] }}
        multiple
        icon={Shuffle}
        iconClass="text-orange-600"
        iconBackgroundClass="bg-orange-100 dark:bg-orange-950/40"
        accent="orange"
        onFilesSelected={addFiles}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-slate-50/70 dark:bg-slate-950/40">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          if (selected.length) void addFiles(selected);
          event.target.value = "";
        }}
      />
      <PdfWorkspaceBar
        title="Organize PDF"
        meta={
          <>
            {files.length} file{files.length === 1 ? "" : "s"} · {pages.length || "..."} page
            {pages.length === 1 ? "" : "s"} · {formatFileSize(totalBytes)}
          </>
        }
        actions={
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={processing || loading}>
            <UiText text="Reset all" />
          </Button>
        }
      />
      <div className="container mx-auto grid w-full max-w-[1500px] flex-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="relative min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">Page board</h2>
              <p className="mt-1 text-sm text-slate-500">Drag pages into place, rotate them, remove extras, or insert blank pages.</p>
            </div>
            <div className="flex items-center gap-3">
              <PdfAddButton count={files.length} label="Add more files" accent="orange" disabled={processing || loading} onClick={() => inputRef.current?.click()} />
              <button
                type="button"
                onClick={sortByOriginalPage}
                disabled={processing || loading}
                className="group/order relative flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 dark:bg-slate-900 dark:ring-slate-800"
                aria-label="Order pages by number"
              >
                <ArrowDown01 className="h-5 w-5" aria-hidden />
                <span className="pointer-events-none absolute right-0 top-14 z-30 whitespace-nowrap rounded bg-slate-950 px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover/order:opacity-100 group-focus-within/order:opacity-100">
                  Order pages by number
                </span>
              </button>
            </div>
          </div>

          {loading && (
            <div className="mb-5 flex items-center gap-3 rounded-lg border bg-white p-4 text-sm text-slate-600 shadow-sm dark:bg-slate-900">
              <Loader2 className="h-5 w-5 animate-spin text-red-600" aria-hidden />
              Rendering page previews...
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(event: DragStartEvent) => setActiveId(event.active.id)}
            onDragEnd={(event: DragEndEvent) => {
              if (event.over && event.active.id !== event.over.id) {
                setPages((current) =>
                  arrayMove(
                    current,
                    current.findIndex((item) => item.id === event.active.id),
                    current.findIndex((item) => item.id === event.over?.id)
                  )
                );
              }
              setActiveId(null);
            }}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={pages.map((item) => item.id)} strategy={rectSortingStrategy}>
              <div className="flex flex-wrap justify-center gap-5 py-4 sm:justify-start">
                {pages.map((item, index) => (
                  <SortablePageCard
                    key={item.id}
                    item={item}
                    index={index}
                    disabled={processing || loading}
                    onRotate={() => rotatePage(item.id)}
                    onRemove={() => removePage(item.id)}
                    onInsertBlankBefore={() => insertBlankBefore(index)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activePage ? <div className="h-[284px] w-[188px] rounded-lg border-2 border-red-200 bg-white shadow-2xl" /> : null}
            </DragOverlay>
          </DndContext>
        </section>

        <aside className="flex min-h-[440px] flex-col border bg-white p-6 shadow-sm dark:bg-slate-900 lg:sticky lg:top-4 lg:h-[calc(100vh-10rem)]">
          <div className="border-b pb-5">
            <h2 className="text-3xl font-bold tracking-tight">Organize pdf</h2>
          </div>
          <div className="space-y-5 py-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold">Files:</h3>
              <button type="button" onClick={clearAll} disabled={processing || loading} className="text-sm font-semibold text-red-600 underline disabled:opacity-50">
                <UiText text="Reset all" />
              </button>
            </div>
            <div className="space-y-2">
              {files.map((item, index) => (
                <div key={item.id} className="flex items-center gap-3 border border-red-200 bg-red-50 px-3 py-3 text-sm text-slate-700">
                  <ArrowLeftRight className="h-4 w-4 text-slate-500" aria-hidden />
                  <span className="shrink-0 font-semibold">{String.fromCharCode(65 + index)}:</span>
                  <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-slate-700 dark:bg-blue-950/30 dark:text-slate-200">
              <FileText className="mr-2 inline h-4 w-4 text-blue-500" aria-hidden />
              {pages.length ? `${pages.length} page${pages.length === 1 ? "" : "s"} in output` : "No page selected."}
              {blankPages > 0 ? ` Includes ${blankPages} blank page${blankPages === 1 ? "" : "s"}.` : ""}
            </div>
          </div>
          <div className="mt-auto space-y-3">
            {processing && <Progress value={progress} className="h-2" aria-label="Organizing PDF" />}
            {failed && !processing && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Could not organize this PDF. Please try again with valid files.</p>
            )}
            <Button variant="outline" className="h-11 w-full" onClick={insertBlankAtEnd} disabled={processing || loading}>
              <FilePlus2 className="mr-2 h-4 w-4" aria-hidden />
              Add blank page
            </Button>
            {processing ? (
              <Button variant="outline" className="h-16 w-full text-base font-bold" onClick={cancel}>
                <UiText text="Cancel" />
              </Button>
            ) : (
              <Button onClick={organizePdf} disabled={loading || pages.length === 0} className="h-16 w-full bg-red-600 text-base font-bold hover:bg-red-700">
                Organize
              </Button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
