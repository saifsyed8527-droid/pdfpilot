"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowRight,
  ArrowUpZA,
  Check,
  FileOutput,
  GripVertical,
  Image as ImageIcon,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  RotateCw,
  ShieldCheck,
  Upload,
  X,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { ResultState } from "@/components/tool/ResultState";
import { TrustSection } from "@/components/tool/TrustSection";
import { getCategoryStyle } from "@/lib/category-colors";
import { getCrossSellTools } from "@/lib/cross-sell";
import { downloadBlob } from "@/lib/download-file";
import {
  createImagePdf,
  type ImagePageMargin,
  type ImagePageOrientation,
  type ImagePageSize,
  type ImagePdfResult,
} from "@/lib/engines/jpg-to-pdf-engine";
import { sortFilesByName } from "@/lib/file-sort";
import { getTool } from "@/lib/tools";
import { useProcessingTask } from "@/lib/use-processing-task";
import { cn, formatFileSize } from "@/lib/utils";

const tool = getTool("/jpg-to-pdf")!;
const toolStyle = getCategoryStyle(tool);
const ToolIcon = tool.icon;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED_IMAGES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

type Rotation = 0 | 90 | 180 | 270;

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  rotation: Rotation;
}

interface ImageCardProps {
  item: ImageItem;
  index: number;
  pageSize: ImagePageSize;
  orientation: ImagePageOrientation;
  margin: ImagePageMargin;
  processing: boolean;
  onDimensions: (id: string, width: number, height: number) => void;
  onRotate: (id: string) => void;
  onRemove: (id: string) => void;
}

function getPaperRatio(item: ImageItem, pageSize: ImagePageSize, orientation: ImagePageOrientation) {
  if (pageSize === "a4") return orientation === "portrait" ? 210 / 297 : 297 / 210;
  if (pageSize === "letter") return orientation === "portrait" ? 215 / 279.4 : 279.4 / 215;
  const quarterTurn = item.rotation === 90 || item.rotation === 270;
  const width = quarterTurn ? item.height : item.width;
  const height = quarterTurn ? item.width : item.height;
  if (!width || !height) return orientation === "portrait" ? 0.72 : 1.4;
  const ratio = width / height;
  return orientation === "portrait" ? Math.min(ratio, 1 / ratio) : Math.max(ratio, 1 / ratio);
}

function paperDimensions(ratio: number) {
  if (ratio >= 1) return { width: 188, height: Math.max(112, 188 / ratio) };
  return { width: Math.max(96, 218 * ratio), height: 218 };
}

function ImageCard({
  item,
  index,
  pageSize,
  orientation,
  margin,
  processing,
  onDimensions,
  onRotate,
  onRemove,
}: ImageCardProps) {
  const sortable = useSortable({ id: item.id, disabled: processing });
  const paper = paperDimensions(getPaperRatio(item, pageSize, orientation));
  const inset = margin === "none" ? 0 : margin === "small" ? 12 : 22;
  const quarterTurn = item.rotation === 90 || item.rotation === 270;
  const imageStyle = {
    transform: `rotate(${item.rotation}deg)`,
    maxWidth: quarterTurn ? Math.max(1, paper.height - inset * 2) : "100%",
    maxHeight: quarterTurn ? Math.max(1, paper.width - inset * 2) : "100%",
  };

  return (
    <article
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.28 : 1,
      }}
      className="group/card relative flex h-[302px] w-[234px] flex-col items-center rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] transition-shadow hover:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
        {formatFileSize(item.file.size)}
        {item.width > 0 ? ` · ${item.width} × ${item.height}` : ""}
      </div>
      <span className="absolute left-2 top-2 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[11px] font-semibold tabular-nums text-white shadow">
        {index + 1}
      </span>
      <div className="absolute right-2 top-2 z-20 flex gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100">
        <CardAction label="Rotate" onClick={() => onRotate(item.id)} disabled={processing}>
          <RotateCw className="h-4 w-4" aria-hidden />
        </CardAction>
        <CardAction label="Remove image" onClick={() => onRemove(item.id)} disabled={processing} destructive>
          <X className="h-4 w-4" aria-hidden />
        </CardAction>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center pt-3">
        <div
          className="relative overflow-hidden bg-white shadow-[0_5px_16px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 transition-[width,height] duration-200 dark:ring-slate-600"
          style={{ width: paper.width, height: paper.height }}
          aria-label={`${orientation} ${pageSize === "fit" ? "image-sized" : pageSize.toUpperCase()} page preview`}
        >
          <div className="absolute flex items-center justify-center overflow-hidden transition-[inset] duration-200" style={{ inset }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL; never uploaded */}
            <img
              src={item.previewUrl}
              alt={`Preview of ${item.file.name}`}
              onLoad={(event) => onDimensions(item.id, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
              className="max-h-full max-w-full object-contain transition-transform duration-200 motion-reduce:transition-none"
              style={imageStyle}
            />
          </div>
        </div>
      </div>

      <div className="mt-2 flex w-full items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          disabled={processing}
          className="flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-default dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label={`Drag to reorder ${item.file.name}`}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-slate-700 dark:text-slate-200" title={item.file.name}>
          {item.file.name}
        </p>
        <span className="h-8 w-8 shrink-0" aria-hidden />
      </div>
    </article>
  );
}

function CardAction({
  label,
  onClick,
  disabled,
  destructive = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="group/action relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200",
          destructive
            ? "hover:border-red-400 hover:bg-red-50 hover:text-red-600 focus-visible:ring-red-500"
            : "hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 focus-visible:ring-amber-500"
        )}
        aria-label={label}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute -top-9 right-0 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/action:opacity-100 group-focus-within/action:opacity-100">
        {label}
      </span>
    </div>
  );
}

function ChoiceCard({
  selected,
  label,
  icon,
  onClick,
  className,
}: {
  selected: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex min-h-[94px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border bg-slate-50 px-3 py-4 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-400",
        selected && "border-amber-500 bg-amber-50 text-amber-800 shadow-[0_0_0_1px_rgb(245_158_11)] hover:border-amber-500 hover:bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300",
        className
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MarginIcon({ size }: { size: ImagePageMargin }) {
  const padding = size === "none" ? "p-0" : size === "small" ? "p-1" : "p-2";
  return (
    <span className={cn("flex h-7 w-7 items-center justify-center border-2 border-current", padding)} aria-hidden>
      <ImageIcon className="h-full w-full" />
    </span>
  );
}

export function JpgToPdfClient() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [orientation, setOrientation] = useState<ImagePageOrientation>("portrait");
  const [pageSize, setPageSize] = useState<ImagePageSize>("a4");
  const [margin, setMargin] = useState<ImagePageMargin>("none");
  const [merge, setMerge] = useState(true);
  const [result, setResult] = useState<ImagePdfResult | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const itemsRef = useRef<ImageItem[]>([]);
  const autoDownloadRef = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask();

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => {
    for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
  }, []);

  // Warm lazy dependencies while the user reviews previews and settings.
  useEffect(() => {
    if (items.length > 0) void import("pdf-lib");
  }, [items.length]);
  useEffect(() => {
    if (!merge && items.length > 1) void import("fflate");
  }, [merge, items.length]);

  const addFiles = useCallback((files: File[]) => {
    const additions = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      width: 0,
      height: 0,
      rotation: 0 as Rotation,
    }));
    setItems((current) => [...current, ...additions]);
    setResult(null);
    autoDownloadRef.current = false;
  }, []);

  const reportRejections = useCallback((rejections: FileRejection[]) => {
    for (const rejection of rejections) {
      for (const error of rejection.errors) {
        if (error.code === "file-too-large") {
          toast.error("Image is too large", { description: `${rejection.file.name} exceeds the 100MB per-file limit.` });
        } else if (error.code === "file-invalid-type") {
          toast.error("Unsupported image", { description: `${rejection.file.name} is not a JPG or PNG image.` });
        } else {
          toast.error("Could not add image", { description: error.message });
        }
      }
    }
  }, []);

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    if (rejected.length > 0) reportRejections(rejected);
    if (accepted.length > 0) addFiles(accepted);
  }, [addFiles, reportRejections]);

  const dropzone = useDropzone({
    onDrop,
    accept: ACCEPTED_IMAGES,
    multiple: true,
    maxSize: MAX_FILE_SIZE,
    noClick: items.length > 0,
    noKeyboard: items.length > 0,
    disabled: processing,
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const totalBytes = useMemo(() => items.reduce((sum, item) => sum + item.file.size, 0), [items]);
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;

  const updateDimensions = useCallback((id: string, width: number, height: number) => {
    setItems((current) => current.map((item) =>
      item.id === id && (item.width !== width || item.height !== height) ? { ...item, width, height } : item
    ));
  }, []);

  const rotateImage = useCallback((id: string) => {
    setItems((current) => current.map((item) =>
      item.id === id ? { ...item, rotation: ((item.rotation + 90) % 360) as Rotation } : item
    ));
    setResult(null);
  }, []);

  const removeImage = useCallback((id: string) => {
    setItems((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    setResult(null);
  }, []);

  const clearAll = useCallback(() => {
    for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
    itemsRef.current = [];
    setItems([]);
    setResult(null);
    setActiveId(null);
    autoDownloadRef.current = false;
  }, []);

  const sortImages = (direction: "asc" | "desc") => {
    setItems((current) => {
      const sortedFiles = sortFilesByName(current.map((item) => item.file), direction);
      const rank = new Map(sortedFiles.map((file, index) => [file, index]));
      return [...current].sort((a, b) => (rank.get(a.file) ?? 0) - (rank.get(b.file) ?? 0));
    });
    setResult(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.over && event.active.id !== event.over.id) {
      setItems((current) => {
        const from = current.findIndex((item) => item.id === event.active.id);
        const to = current.findIndex((item) => item.id === event.over?.id);
        return from >= 0 && to >= 0 ? arrayMove(current, from, to) : current;
      });
      setResult(null);
    }
    setActiveId(null);
  };

  const convertToPdf = () => {
    if (items.length === 0) return;
    const inputs = items.map((item) => ({ file: item.file, rotation: item.rotation }));
    const options = { orientation, pageSize, margin, merge };
    run(async (setProgress, isCancelled) => {
      setResult(null);
      autoDownloadRef.current = false;
      const output = await createImagePdf(inputs, options, setProgress, isCancelled);
      if (output && !isCancelled()) setResult(output);
    }, {
      successMessage: merge || items.length === 1 ? "Your PDF is ready!" : "Your PDF files are ready!",
      toolName: "jpg-to-pdf",
      errorTitle: "Could not convert these images",
      onError: (error) => {
        console.error("JPG to PDF conversion failed:", error);
        return "One image may be damaged or use an unsupported color format. Remove it and try again.";
      },
    });
  };

  const downloadResult = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);

  if (result) return <ResultView result={result} onDownload={downloadResult} onStartOver={clearAll} autoDownloadRef={autoDownloadRef} />;

  if (items.length === 0) {
    return (
      <div className="flex flex-1 bg-[radial-gradient(circle_at_50%_18%,rgba(251,191,36,0.13),transparent_34%),linear-gradient(to_bottom,#f8fafc,#ffffff)] py-10 dark:bg-[radial-gradient(circle_at_50%_18%,rgba(251,191,36,0.09),transparent_34%)] md:py-14">
        <div className="container mx-auto flex max-w-5xl flex-1 flex-col px-4">
          <BackToHome />
          <section className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
            <div className={cn("mb-5 flex h-16 w-16 items-center justify-center rounded-2xl", toolStyle.bgClass)}>
              <ToolIcon className={cn("h-8 w-8", toolStyle.iconClass)} aria-hidden />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white md:text-5xl">JPG to PDF</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">
              Turn JPG and PNG images into a polished PDF. Arrange every page, choose its layout, and download in seconds.
            </p>
            <div
              {...dropzone.getRootProps({ role: "button", "aria-label": "Select JPG or PNG images, or drop them here" })}
              className={cn(
                "mt-9 w-full max-w-xl cursor-pointer rounded-3xl border-2 border-dashed bg-white p-5 shadow-[0_22px_70px_-46px_rgba(15,23,42,0.55)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-slate-900",
                dropzone.isDragActive ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-slate-200 hover:border-amber-400"
              )}
            >
              <input {...dropzone.getInputProps()} />
              <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl bg-slate-50 px-5 py-8 dark:bg-slate-950/60">
                <span className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-slate-950 px-7 py-4 text-base font-semibold text-white shadow-lg dark:bg-amber-500 dark:text-slate-950 md:text-lg">
                  <Upload className="h-5 w-5" aria-hidden />
                  {dropzone.isDragActive ? "Drop images here" : "Select JPG images"}
                </span>
                <span className="mt-4 text-sm text-slate-500">or drag and drop JPG / PNG files here</span>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden /> Files stay on your device</span>
              <span>100MB max per image</span>
              <span>No account needed</span>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50">
      <WorkspaceBar items={items} totalBytes={totalBytes} processing={processing} onSort={sortImages} onClear={clearAll} />
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <section
          {...dropzone.getRootProps()}
          className="relative min-h-[620px] border-b p-5 focus-visible:outline-none lg:border-b-0 lg:border-r lg:p-8"
          aria-label="Selected images workspace. Drop more JPG or PNG images anywhere in this area."
        >
          <input {...dropzone.getInputProps()} />
          {dropzone.isDragActive && <DropOverlay />}
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Arrange your pages</p>
                <p className="mt-1 text-xs text-slate-500">Hover an image for size, rotate, and remove controls.</p>
              </div>
              <AddButton count={items.length} processing={processing} onClick={dropzone.open} />
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(event: DragStartEvent) => setActiveId(event.active.id)}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={itemIds} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 justify-items-center gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((item, index) => (
                    <ImageCard
                      key={item.id}
                      item={item}
                      index={index}
                      pageSize={pageSize}
                      orientation={orientation}
                      margin={margin}
                      processing={processing}
                      onDimensions={updateDimensions}
                      onRotate={rotateImage}
                      onRemove={removeImage}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeItem ? (
                  <div className="flex w-56 items-center gap-3 rounded-xl border bg-white p-3 shadow-2xl dark:bg-slate-900">
                    <GripVertical className="h-4 w-4 text-slate-400" aria-hidden />
                    <p className="truncate text-sm font-medium">{activeItem.file.name}</p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </section>
        <OptionsPanel
          orientation={orientation}
          pageSize={pageSize}
          margin={margin}
          merge={merge}
          processing={processing}
          progress={progress}
          onOrientation={setOrientation}
          onPageSize={setPageSize}
          onMargin={setMargin}
          onMerge={() => setMerge((current) => !current)}
          onConvert={convertToPdf}
          onCancel={cancel}
        />
      </div>
    </div>
  );
}

function BackToHome() {
  return (
    <Link href="/" className="mb-7 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Home
    </Link>
  );
}

function ResultView({
  result,
  onDownload,
  onStartOver,
  autoDownloadRef,
}: {
  result: ImagePdfResult;
  onDownload: () => void;
  onStartOver: () => void;
  autoDownloadRef: MutableRefObject<boolean>;
}) {
  return (
    <div className="flex-1 bg-slate-50/70 py-10 dark:bg-slate-950/40 md:py-14">
      <div className="container mx-auto max-w-4xl px-4">
        <BackToHome />
        <section className="rounded-3xl border bg-white px-5 py-8 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.5)] dark:bg-slate-900 md:px-10">
          <ResultState
            resultFilename={result.filename}
            fileSize={formatFileSize(result.blob.size)}
            onDownload={onDownload}
            downloadLabel={result.filename.endsWith(".zip") ? "Download ZIP" : "Download PDF"}
            onStartOver={onStartOver}
            autoDownloadedRef={autoDownloadRef}
          />
        </section>
        <RelatedTools title="Continue with your PDF" tools={getCrossSellTools("jpg-to-pdf")} />
        <TrustSection />
      </div>
    </div>
  );
}

function WorkspaceBar({ items, totalBytes, processing, onSort, onClear }: {
  items: ImageItem[];
  totalBytes: number;
  processing: boolean;
  onSort: (direction: "asc" | "desc") => void;
  onClear: () => void;
}) {
  return (
    <div className="border-b bg-white/95 dark:bg-slate-900/95">
      <div className="container mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Back to Home">
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight">JPG to PDF</h1>
            <p className="text-xs text-slate-500" aria-live="polite">
              {items.length} image{items.length === 1 ? "" : "s"} · {formatFileSize(totalBytes)} · drag to reorder
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 1 && <>
            <Button variant="outline" size="sm" onClick={() => onSort("asc")} disabled={processing} aria-label="Sort images A to Z"><ArrowDownAZ className="h-4 w-4" aria-hidden /> A–Z</Button>
            <Button variant="outline" size="sm" onClick={() => onSort("desc")} disabled={processing} aria-label="Sort images Z to A"><ArrowUpZA className="h-4 w-4" aria-hidden /> Z–A</Button>
          </>}
          <Button variant="ghost" size="sm" onClick={onClear} disabled={processing}>Clear</Button>
        </div>
      </div>
    </div>
  );
}

function DropOverlay() {
  return (
    <div className="absolute inset-4 z-30 flex items-center justify-center rounded-3xl border-2 border-dashed border-amber-500 bg-amber-50/95 text-center dark:bg-amber-950/90">
      <div><Upload className="mx-auto h-10 w-10 text-amber-600" aria-hidden /><p className="mt-3 text-lg font-semibold">Drop to add more images</p></div>
    </div>
  );
}

function AddButton({ count, processing, onClick }: { count: number; processing: boolean; onClick: () => void }) {
  return (
    <div className="group/add relative">
      <button
        type="button"
        onClick={onClick}
        disabled={processing}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-500 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:bg-amber-500 dark:text-slate-950 motion-reduce:hover:translate-y-0"
        aria-label="Add more images"
      >
        <Plus className="h-6 w-6" aria-hidden />
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-slate-950 ring-2 ring-slate-950 dark:ring-amber-500">{count}</span>
      </button>
      <span className="pointer-events-none absolute right-0 top-14 z-30 whitespace-nowrap rounded bg-slate-950 px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover/add:opacity-100 group-focus-within/add:opacity-100">Add more images</span>
    </div>
  );
}

interface OptionsPanelProps {
  orientation: ImagePageOrientation;
  pageSize: ImagePageSize;
  margin: ImagePageMargin;
  merge: boolean;
  processing: boolean;
  progress: number;
  onOrientation: (value: ImagePageOrientation) => void;
  onPageSize: (value: ImagePageSize) => void;
  onMargin: (value: ImagePageMargin) => void;
  onMerge: () => void;
  onConvert: () => void;
  onCancel: () => void;
}

function OptionsPanel(props: OptionsPanelProps) {
  return (
    <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[560px] lg:p-6">
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-5 flex shrink-0 items-center gap-3 border-b pb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><FileOutput className="h-5 w-5" aria-hidden /></span>
          <div><h2 className="text-xl font-bold tracking-tight">PDF options</h2><p className="text-xs text-slate-500">Preview updates instantly</p></div>
        </div>
        <fieldset disabled={props.processing} className="min-h-0 space-y-5 overflow-y-auto pr-1 lg:flex-1">
          <div>
            <p className="mb-3 text-sm font-semibold">Page orientation</p>
            <div className="flex gap-3">
              <ChoiceCard selected={props.orientation === "portrait"} label="Portrait" icon={<RectangleVertical className="h-7 w-7" aria-hidden />} onClick={() => props.onOrientation("portrait")} />
              <ChoiceCard selected={props.orientation === "landscape"} label="Landscape" icon={<RectangleHorizontal className="h-7 w-7" aria-hidden />} onClick={() => props.onOrientation("landscape")} />
            </div>
          </div>
          <div>
            <label className="mb-3 block text-sm font-semibold" htmlFor="jpg-page-size">Page size</label>
            <Select value={props.pageSize} onValueChange={(value) => props.onPageSize(value as ImagePageSize)} disabled={props.processing}>
              <SelectTrigger id="jpg-page-size" className="h-12 rounded-xl bg-white px-4 text-sm dark:bg-slate-950"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fit">Fit — same size as image</SelectItem>
                <SelectItem value="a4">A4 — 210 × 297 mm</SelectItem>
                <SelectItem value="letter">US Letter — 8.5 × 11 in</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Margin</p>
            <div className="grid grid-cols-3 gap-2.5">
              {(["none", "small", "big"] as ImagePageMargin[]).map((value) => (
                <ChoiceCard key={value} selected={props.margin === value} label={value === "none" ? "No margin" : value === "small" ? "Small" : "Big"} icon={<MarginIcon size={value} />} onClick={() => props.onMargin(value)} className="min-h-[92px] px-1" />
              ))}
            </div>
          </div>
          <button
            type="button"
            role="checkbox"
            aria-checked={props.merge}
            onClick={props.onMerge}
            className="flex w-full items-start gap-3 rounded-xl border border-transparent p-2 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:hover:bg-slate-800"
          >
            <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border", props.merge ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white dark:bg-slate-950")}>{props.merge && <Check className="h-3.5 w-3.5" aria-hidden />}</span>
            <span><span className="block text-sm font-medium">Merge all images in one PDF</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{props.merge ? "One page per image, in the order shown." : "Get one PDF per image in a ZIP file."}</span></span>
          </button>
        </fieldset>
        {props.processing ? (
          <div className="mt-5 shrink-0"><ProcessingState progress={props.progress} label="Building your PDF…" onCancel={props.onCancel} /></div>
        ) : (
          <button type="button" onClick={props.onConvert} className="mt-5 flex min-h-16 w-full shrink-0 items-center justify-center gap-3 rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-500 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:bg-amber-500 dark:text-slate-950 motion-reduce:hover:translate-y-0">
            Convert to PDF <ArrowRight className="h-5 w-5" aria-hidden />
          </button>
        )}
        <p className="mt-3 flex shrink-0 items-center justify-center gap-2 text-center text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden /> Browser-local conversion · nothing is uploaded</p>
      </div>
    </aside>
  );
}
