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
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Image as ImageIcon,
  Plus,
  QrCode,
  RectangleHorizontal,
  RectangleVertical,
  RotateCw,
  ShieldCheck,
  Smartphone,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { ResultState } from "@/components/tool/ResultState";
import { TrustSection } from "@/components/tool/TrustSection";
import {
  createImagePdf,
  type ImagePageMargin,
  type ImagePageSize,
  type ImagePdfResult,
} from "@/lib/engines/jpg-to-pdf-engine";
import { getCrossSellTools } from "@/lib/cross-sell";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { cn, formatFileSize } from "@/lib/utils";

const ACCEPTED_IMAGES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};
const MAX_FILE_SIZE = 100 * 1024 * 1024;

type Orientation = "portrait" | "landscape";
type Rotation = 0 | 90 | 180 | 270;

interface ScanItem {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  rotation: Rotation;
}

function BackToHome() {
  return (
    <Link href="/" className="mb-7 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Home
    </Link>
  );
}

function QrPreview() {
  const cells = Array.from({ length: 81 }, (_, index) => {
    const x = index % 9;
    const y = Math.floor(index / 9);
    const finder =
      (x < 3 && y < 3) ||
      (x > 5 && y < 3) ||
      (x < 3 && y > 5);
    return finder || (index * 17 + x * 5 + y * 11) % 4 !== 0;
  });

  return (
    <div className="grid h-48 w-48 grid-cols-9 gap-1 rounded-xl bg-white p-3 ring-1 ring-slate-200" aria-hidden>
      {cells.map((filled, index) => (
        <span key={index} className={cn("rounded-[2px]", filled ? "bg-slate-950" : "bg-transparent")} />
      ))}
    </div>
  );
}

function LandingCard({
  muted,
  children,
}: {
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[360px] w-full max-w-sm flex-col items-center justify-center rounded-2xl bg-white px-8 py-10 text-center shadow-[0_22px_60px_-42px_rgba(15,23,42,0.55)] dark:bg-slate-900",
        muted && "opacity-35"
      )}
    >
      {children}
    </div>
  );
}

function ScanLanding({
  dragActive,
  getRootProps,
  getInputProps,
  onCamera,
}: {
  dragActive: boolean;
  getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
  getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
  onCamera: () => void;
}) {
  return (
    <div className="flex flex-1 bg-[#f7f7fb] py-10 dark:bg-slate-950/50 md:py-14">
      <div className="container mx-auto flex max-w-6xl flex-1 flex-col px-4">
        <BackToHome />
        <section className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white">Scan to PDF</h1>
          <p className="mt-4 max-w-3xl text-xl leading-8 text-slate-600 dark:text-slate-300">
            Scan documents from your phone or add camera images from this browser.
          </p>
          <div className="mt-9 grid w-full max-w-4xl gap-7 md:grid-cols-2">
            <LandingCard>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Step 1</h2>
              <p className="mt-5 text-base leading-7 text-slate-600 dark:text-slate-300">
                Use your phone camera, scanner app, or saved photos.
              </p>
              <div className="mt-8">
                <QrPreview />
              </div>
              <button
                type="button"
                onClick={onCamera}
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-500 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                <Camera className="h-5 w-5" aria-hidden />
                Use camera
              </button>
            </LandingCard>
            <LandingCard muted>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Step 2</h2>
              <p className="mt-2 text-sm font-medium text-slate-400">Waiting for images</p>
              <p className="mt-8 max-w-xs text-base leading-8 text-slate-500">
                After you add photos, choose page orientation, size, margins, then save them as a PDF.
              </p>
              <Smartphone className="mt-8 h-24 w-24 text-slate-300" aria-hidden />
            </LandingCard>
          </div>
          <div
            {...getRootProps({ role: "button", "aria-label": "Upload scan images or drop them here" })}
            className={cn(
              "mt-8 flex min-h-24 w-full max-w-xl cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-5 py-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-slate-900",
              dragActive ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-slate-200 hover:border-red-400"
            )}
          >
            <input {...getInputProps()} />
            <span className="inline-flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
              <Upload className="h-5 w-5 text-red-500" aria-hidden />
              {dragActive ? "Drop scans here" : "Select scan images"}
            </span>
            <span className="mt-2 text-sm text-slate-500">or drop JPG / PNG scans here</span>
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

function ScanCard({
  item,
  index,
  orientation,
  margin,
  processing,
  onDimensions,
  onRotate,
  onRemove,
}: {
  item: ScanItem;
  index: number;
  orientation: Orientation;
  margin: ImagePageMargin;
  processing: boolean;
  onDimensions: (id: string, width: number, height: number) => void;
  onRotate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const paperClass = orientation === "portrait" ? "h-[260px] w-[188px]" : "h-[188px] w-[260px]";
  const inset = margin === "none" ? 0 : margin === "small" ? 14 : 28;
  const quarterTurn = item.rotation === 90 || item.rotation === 270;

  return (
    <article className="group/card relative flex h-[330px] w-[276px] flex-col items-center justify-center rounded-lg bg-white p-4 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.65)] ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      <div className="pointer-events-none absolute -top-10 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
        {formatFileSize(item.file.size)}
        {item.width ? ` · ${item.width}×${item.height}` : ""}
      </div>
      <div className="absolute right-3 top-3 z-20 flex gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100">
        <CardAction label="Rotate" disabled={processing} onClick={() => onRotate(item.id)}>
          <RotateCw className="h-4 w-4" aria-hidden />
        </CardAction>
        <CardAction label="Remove image" disabled={processing} onClick={() => onRemove(item.id)} destructive>
          <X className="h-4 w-4" aria-hidden />
        </CardAction>
      </div>
      <div className={cn("relative flex items-center justify-center overflow-hidden bg-white shadow-md transition-all", paperClass)}>
        <div className="absolute flex items-center justify-center overflow-hidden transition-[inset]" style={{ inset }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL; never uploaded */}
          <img
            src={item.previewUrl}
            alt={`Scan ${index + 1}: ${item.file.name}`}
            onLoad={(event) => onDimensions(item.id, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
            className="max-h-full max-w-full object-contain transition-transform"
            style={{
              transform: `rotate(${item.rotation}deg)`,
              maxWidth: quarterTurn ? "80%" : "100%",
              maxHeight: quarterTurn ? "80%" : "100%",
            }}
          />
        </div>
      </div>
      <p className="mt-4 w-full truncate text-center text-sm font-medium text-slate-600 dark:text-slate-300" title={item.file.name}>
        {item.file.name || `scan-${index + 1}.jpg`}
      </p>
    </article>
  );
}

function CardAction({
  label,
  disabled,
  destructive,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  destructive?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="group/action relative">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-200 transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700",
          destructive ? "hover:bg-red-50 hover:text-red-600 focus-visible:ring-red-500" : "hover:bg-red-50 hover:text-red-600 focus-visible:ring-red-500"
        )}
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
}: {
  selected: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex min-h-[96px] flex-1 flex-col items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-4 text-sm font-medium text-slate-500 shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-slate-800",
        selected && "bg-white text-red-600 ring-2 ring-red-500 dark:bg-slate-950"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MarginIcon({ value }: { value: ImagePageMargin }) {
  const padding = value === "none" ? "p-0" : value === "small" ? "p-1" : "p-2";
  return (
    <span className={cn("flex h-8 w-8 items-center justify-center border-2 border-current", padding)} aria-hidden>
      <ImageIcon className="h-full w-full" />
    </span>
  );
}

function OptionsPanel({
  orientation,
  pageSize,
  margin,
  merge,
  processing,
  progress,
  onOrientation,
  onPageSize,
  onMargin,
  onMerge,
  onSave,
  onCancel,
}: {
  orientation: Orientation;
  pageSize: ImagePageSize;
  margin: ImagePageMargin;
  merge: boolean;
  processing: boolean;
  progress: number;
  onOrientation: (value: Orientation) => void;
  onPageSize: (value: ImagePageSize) => void;
  onMargin: (value: ImagePageMargin) => void;
  onMerge: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-5.15rem)] lg:min-h-[640px] lg:border-l lg:p-6">
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-6 border-b pb-5 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Scan options</h2>
        </div>
        <fieldset disabled={processing} className="min-h-0 space-y-6 overflow-y-auto pr-1 lg:flex-1">
          <div>
            <p className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Select the page orientation</p>
            <div className="grid grid-cols-2 gap-3">
              <ChoiceCard selected={orientation === "portrait"} label="Portrait" icon={<RectangleVertical className="h-8 w-8" aria-hidden />} onClick={() => onOrientation("portrait")} />
              <ChoiceCard selected={orientation === "landscape"} label="Landscape" icon={<RectangleHorizontal className="h-8 w-8" aria-hidden />} onClick={() => onOrientation("landscape")} />
            </div>
          </div>
          <div>
            <label htmlFor="scan-page-size" className="mb-3 block text-sm font-bold text-slate-800 dark:text-slate-100">Page size</label>
            <select
              id="scan-page-size"
              value={pageSize}
              onChange={(event) => onPageSize(event.currentTarget.value as ImagePageSize)}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="fit">Fit (same page size as image)</option>
              <option value="a4">A4 (297×210 mm)</option>
              <option value="letter">US Letter (215×279.4 mm)</option>
            </select>
          </div>
          <div>
            <p className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Margin</p>
            <div className="grid grid-cols-3 gap-2.5">
              {(["none", "small", "big"] as ImagePageMargin[]).map((value) => (
                <ChoiceCard
                  key={value}
                  selected={margin === value}
                  label={value === "none" ? "No margin" : value === "small" ? "Small" : "Big"}
                  icon={<MarginIcon value={value} />}
                  onClick={() => onMargin(value)}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            role="checkbox"
            aria-checked={merge}
            onClick={onMerge}
            className="flex w-full items-center gap-3 rounded-lg p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2", merge ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-slate-300 bg-white text-transparent")}>
              <Check className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-base text-slate-700 dark:text-slate-200">Merge all images in one PDF file</span>
          </button>
        </fieldset>
        {processing ? (
          <div className="mt-6 shrink-0">
            <ProcessingState progress={progress} label="Saving scans to PDF..." onCancel={onCancel} />
          </div>
        ) : (
          <button
            type="button"
            onClick={onSave}
            className="mt-6 flex min-h-16 w-full shrink-0 items-center justify-center gap-3 rounded-xl bg-red-500 px-6 py-4 text-xl font-bold text-white shadow-lg transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            Save to PDF <ArrowRight className="h-6 w-6" aria-hidden />
          </button>
        )}
        <p className="mt-3 flex shrink-0 items-center justify-center gap-2 text-center text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden /> Browser-local conversion
        </p>
      </div>
    </aside>
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
        <RelatedTools title="Continue with your PDF" tools={getCrossSellTools("scan-pdf")} />
        <TrustSection />
      </div>
    </div>
  );
}

export function ScanPdfClient() {
  const [items, setItems] = useState<ScanItem[]>([]);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [pageSize, setPageSize] = useState<ImagePageSize>("a4");
  const [margin, setMargin] = useState<ImagePageMargin>("none");
  const [merge, setMerge] = useState(true);
  const [result, setResult] = useState<ImagePdfResult | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<ScanItem[]>([]);
  const autoDownloadRef = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask();

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => {
    for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
  }, []);

  useEffect(() => {
    if (items.length > 0) void import("pdf-lib");
  }, [items.length]);

  const addFiles = useCallback((files: File[]) => {
    const valid = files.filter((file) => file.type === "image/jpeg" || file.type === "image/png");
    if (valid.length !== files.length) {
      toast.error("Only JPG and PNG scans are supported right now.");
    }
    if (valid.length === 0) return;
    setItems((current) => [
      ...current,
      ...valid.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        width: 0,
        height: 0,
        rotation: 0 as Rotation,
      })),
    ]);
    setResult(null);
    autoDownloadRef.current = false;
  }, []);

  const reportRejections = useCallback((rejections: FileRejection[]) => {
    for (const rejection of rejections) {
      for (const error of rejection.errors) {
        toast.error(error.code === "file-too-large" ? "Image is too large" : "Could not add image", {
          description: error.code === "file-too-large" ? `${rejection.file.name} exceeds 100MB.` : error.message,
        });
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

  const totalBytes = useMemo(() => items.reduce((sum, item) => sum + item.file.size, 0), [items]);

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
    autoDownloadRef.current = false;
  }, []);

  const savePdf = () => {
    if (items.length === 0) return;
    const inputs = items.map((item) => ({ file: item.file, rotation: item.rotation }));
    run(async (setProgress, isCancelled) => {
      setResult(null);
      autoDownloadRef.current = false;
      const output = await createImagePdf(inputs, { orientation, pageSize, margin, merge }, setProgress, isCancelled);
      if (!output || isCancelled()) return;
      const filename = output.filename.endsWith(".zip") ? "scanned-pages.zip" : "scanned-document.pdf";
      setResult({ ...output, filename });
    }, {
      successMessage: merge || items.length === 1 ? "Your scanned PDF is ready!" : "Your scanned PDFs are ready!",
      toolName: "scan-pdf",
      errorTitle: "Could not save these scans",
      onError: (error) => {
        console.error("Scan to PDF failed:", error);
        return "One image may be damaged or unsupported. Remove it and try again.";
      },
    });
  };

  const downloadResult = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);

  if (result) {
    return <ResultView result={result} onDownload={downloadResult} onStartOver={clearAll} autoDownloadRef={autoDownloadRef} />;
  }

  return (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      {items.length === 0 ? (
        <ScanLanding
          dragActive={dropzone.isDragActive}
          getRootProps={dropzone.getRootProps}
          getInputProps={dropzone.getInputProps}
          onCamera={() => cameraInputRef.current?.click()}
        />
      ) : (
        <div className="flex-1 bg-[#f7f7fb] dark:bg-slate-950/50">
          <div className="grid min-h-[calc(100vh-5.15rem)] lg:grid-cols-[minmax(0,1fr)_420px]">
            <section
              {...dropzone.getRootProps()}
              className="relative flex min-h-[620px] flex-col border-b p-5 focus-visible:outline-none lg:border-b-0 lg:p-8"
              aria-label="Scan workspace. Drop more images anywhere in this area."
            >
              <input {...dropzone.getInputProps()} />
              {dropzone.isDragActive && (
                <div className="absolute inset-4 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-red-500 bg-red-50/95 text-center dark:bg-red-950/80">
                  <div><Upload className="mx-auto h-10 w-10 text-red-500" aria-hidden /><p className="mt-3 text-lg font-semibold">Drop to add more scans</p></div>
                </div>
              )}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">Scan to PDF</h1>
                  <p className="mt-1 text-sm text-slate-500">{items.length} image{items.length === 1 ? "" : "s"} · {formatFileSize(totalBytes)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <FloatingButton count={items.length} label="Add more files" onClick={dropzone.open} disabled={processing}>
                    <Plus className="h-7 w-7" aria-hidden />
                  </FloatingButton>
                  <FloatingButton label="Use camera" onClick={() => cameraInputRef.current?.click()} disabled={processing}>
                    <Camera className="h-5 w-5" aria-hidden />
                  </FloatingButton>
                  <FloatingButton label="Show QR" onClick={() => toast.info("Use camera or upload scans from your device.")} disabled={processing} pale>
                    <QrCode className="h-5 w-5" aria-hidden />
                  </FloatingButton>
                </div>
              </div>
              <div className="flex flex-1 items-center justify-center">
                <div className="grid max-w-5xl grid-cols-1 justify-items-center gap-8 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((item, index) => (
                    <ScanCard
                      key={item.id}
                      item={item}
                      index={index}
                      orientation={orientation}
                      margin={margin}
                      processing={processing}
                      onDimensions={updateDimensions}
                      onRotate={rotateImage}
                      onRemove={removeImage}
                    />
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={clearAll}
                disabled={processing}
                className="absolute bottom-5 left-5 text-sm font-semibold text-red-500 underline-offset-4 hover:underline disabled:opacity-50"
              >
                Reset all
              </button>
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
              onSave={savePdf}
              onCancel={cancel}
            />
          </div>
        </div>
      )}
    </>
  );
}

function FloatingButton({
  label,
  count,
  disabled,
  pale,
  onClick,
  children,
}: {
  label: string;
  count?: number;
  disabled?: boolean;
  pale?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="group/floating relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50",
          pale ? "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200" : "bg-red-500 text-white hover:bg-red-600"
        )}
        aria-label={label}
      >
        {children}
        {typeof count === "number" && <span className="absolute -left-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950 px-1 text-xs font-bold text-white ring-2 ring-red-500">{count}</span>}
      </button>
      <span className="pointer-events-none absolute right-14 top-1/2 z-30 -translate-y-1/2 whitespace-nowrap rounded bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover/floating:opacity-100 group-focus-within/floating:opacity-100">
        {label}
      </span>
    </div>
  );
}
