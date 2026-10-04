"use client";

import { UiText, useToolCopy } from "@/components/i18n/UiText";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LocaleLink as Link } from "@/components/i18n/LocaleLink";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Camera,
  Check,
  Image as ImageIcon,
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
import { ResultState } from "@/components/tool/ResultState";
import { PdfAddButton, PdfWorkspaceBar, PdfToolResultLayout } from "@/components/tool/PdfToolChrome";
import {
  createImagePdf,
  type ImagePageMargin,
  type ImagePageSize,
  type ImagePdfResult,
} from "@/lib/engines/jpg-to-pdf-engine";
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
  invalid?: boolean;
}

function BackToHome() {
  return (
    <Link href="/" className="mb-7 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden /> <UiText text="Back to Home" />
    </Link>
  );
}

function ScanLanding({ dragActive, getRootProps, getInputProps, onCamera }: {
  dragActive: boolean;
  getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
  getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
  onCamera: () => void;
}) {
  const copy = useToolCopy();
  return (
    <div className="pdf-tool-landing flex flex-1 py-10 md:py-14">
      <div className="container mx-auto flex max-w-5xl flex-1 flex-col px-4">
        <BackToHome />
        <section className="flex flex-1 flex-col items-center pb-12 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/40"><Camera className="h-8 w-8" aria-hidden /></div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white md:text-5xl">{copy.title("Scan to PDF")}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">{copy.description("Scan documents from your phone or add camera images from this browser.")}</p>
          <div {...getRootProps({ role: "button", "aria-label": "Upload scan images or drop them here" })}
            className={cn("mt-9 w-full max-w-xl cursor-pointer rounded-3xl border-2 border-dashed bg-white p-5 shadow-[0_22px_70px_-46px_rgba(15,23,42,0.55)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:bg-slate-900", dragActive ? "border-orange-500" : "border-slate-200 hover:border-orange-400")}>
            <input {...getInputProps()} />
            <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl bg-slate-50 px-5 py-8 dark:bg-slate-950/60">
              <span className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-slate-950 px-7 py-4 text-base font-semibold text-white shadow-lg dark:bg-orange-500 dark:text-slate-950"><Upload className="h-5 w-5" aria-hidden />{dragActive ? copy.t("Drop files here") : copy.t("Select scan images")}</span>
              <span className="mt-4 text-sm text-slate-500">{copy.locale === "en" ? "or drop JPG / PNG scans here" : copy.common.imageDrop}</span>
            </div>
          </div>
          <button type="button" onClick={onCamera} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl border bg-white px-5 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:bg-slate-900"><Camera className="h-5 w-5" aria-hidden /><UiText text="Use camera" /></button>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden /><UiText text="Files stay on your device" /></span><span><UiText text="100MB max per image" /></span><span><UiText text="No account needed" /></span></div>
          <div className="mt-7 flex max-w-xl items-start gap-3 rounded-2xl border bg-white p-4 text-left text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300"><Smartphone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /><p>Phone-to-computer transfer is not available yet. You can scan on this device, or import photos you have already saved here.</p></div>
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
  onInvalid,
  onMove,
  total,
}: {
  item: ScanItem;
  index: number;
  orientation: Orientation;
  margin: ImagePageMargin;
  processing: boolean;
  onDimensions: (id: string, width: number, height: number) => void;
  onRotate: (id: string) => void;
  onRemove: (id: string) => void;
  onInvalid: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  total: number;
}) {
  const paperClass = orientation === "portrait" ? "h-[260px] w-[188px]" : "h-[188px] w-[260px]";
  const inset = margin === "none" ? 0 : margin === "small" ? 14 : 28;
  const quarterTurn = item.rotation === 90 || item.rotation === 270;
  const paperWidth = orientation === "portrait" ? 188 : 260;
  const paperHeight = orientation === "portrait" ? 260 : 188;
  const previewScale = item.width && item.height ? Math.min(
    (paperWidth - inset * 2) / (quarterTurn ? item.height : item.width),
    (paperHeight - inset * 2) / (quarterTurn ? item.width : item.height)
  ) : 1;

  return (
    <article className="group/card relative flex min-h-[380px] w-[276px] max-w-full flex-col items-center justify-center rounded-lg bg-white p-4 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.65)] ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      <div className="pointer-events-none absolute -top-10 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
        {formatFileSize(item.file.size)}
        {item.width ? ` · ${item.width}×${item.height}` : ""}
      </div>
      <div className="absolute right-3 top-3 z-20 flex gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100">
        <CardAction label={`Rotate ${item.file.name}`} disabled={processing} onClick={() => onRotate(item.id)}>
          <RotateCw className="h-4 w-4" aria-hidden />
        </CardAction>
        <CardAction label={`Remove ${item.file.name}`} disabled={processing} onClick={() => onRemove(item.id)} destructive>
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
            onError={() => onInvalid(item.id)}
            className="max-w-none object-contain transition-transform"
            style={{
              transform: `rotate(${item.rotation}deg)`,
              width: item.width ? item.width * previewScale : "100%",
              height: item.height ? item.height * previewScale : "auto",
            }}
          />
        </div>
      </div>
      <p className="mt-4 w-full truncate text-center text-sm font-medium text-slate-600 dark:text-slate-300" title={item.file.name}>{index + 1}. {item.file.name || `scan-${index + 1}.jpg`}</p>
      {item.invalid && <p role="alert" className="mt-2 text-center text-xs text-destructive">This image could not be read. Remove it and choose another.</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" aria-label={`Move ${item.file.name} earlier`} disabled={processing || index === 0} onClick={() => onMove(item.id, -1)} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-orange-500"><ArrowUp className="mr-1 inline h-3 w-3" aria-hidden />Earlier</button>
        <button type="button" aria-label={`Move ${item.file.name} later`} disabled={processing || index === total - 1} onClick={() => onMove(item.id, 1)} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-orange-500"><ArrowDown className="mr-1 inline h-3 w-3" aria-hidden />Later</button>
      </div>
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
          destructive ? "hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive" : "hover:bg-orange-50 hover:text-orange-600 focus-visible:ring-orange-500"
        )}
      >
        {children}
      </button>
      <span aria-hidden className="pointer-events-none absolute -top-9 right-0 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/action:opacity-100 group-focus-within/action:opacity-100">
        {destructive ? "Remove image" : "Rotate"}
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
        "flex min-h-[96px] flex-1 flex-col items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-4 text-sm font-medium text-slate-500 shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:bg-slate-800",
        selected && "bg-white text-orange-600 ring-2 ring-orange-500 dark:bg-slate-950"
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
  canSave,
  failure,
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
  canSave: boolean;
  failure: boolean;
}) {
  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:p-6">
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-6 border-b pb-5 text-center">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Scan options</h2>
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
            <label htmlFor="scan-page-size" className="mb-3 block text-sm font-bold text-slate-800 dark:text-slate-100"><UiText text="Page size" /></label>
            <select
              id="scan-page-size"
              value={pageSize}
              onChange={(event) => onPageSize(event.currentTarget.value as ImagePageSize)}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="fit">Fit (same page size as image)</option>
              <option value="a4">A4 (297×210 mm)</option>
              <option value="letter">US Letter (215×279.4 mm)</option>
            </select>
          </div>
          <div>
            <p className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100"><UiText text="Margin" /></p>
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
            className="flex w-full items-center gap-3 rounded-lg p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2", merge ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-slate-300 bg-white text-transparent")}>
              <Check className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-base text-slate-700 dark:text-slate-200">Merge all images in one PDF file</span>
          </button>
        </fieldset>
        {failure && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">One image could not be converted. Remove the unreadable image, replace it, and try again.</p>}
        {processing ? (
          <div className="mt-6 shrink-0">
            <ProcessingState progress={progress} label="Saving scans to PDF..." onCancel={onCancel} />
          </div>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="mt-6 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-orange-500 dark:text-slate-950 flex min-h-16 w-full shrink-0 items-center justify-center gap-3 rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            {failure ? "Try Again" : "Save to PDF"} <ArrowRight className="h-6 w-6" aria-hidden />
          </button>
        )}
        <p className="mt-3 flex shrink-0 items-center justify-center gap-2 text-center text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden /> Browser-local conversion
        </p>
      </div>
    </aside>
  );
}

export function ScanPdfClient() {
  const [items, setItems] = useState<ScanItem[]>([]);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [pageSize, setPageSize] = useState<ImagePageSize>("a4");
  const [margin, setMargin] = useState<ImagePageMargin>("none");
  const [merge, setMerge] = useState(true);
  const [failure, setFailure] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraDialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraSessionRef = useRef(0);
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
    const valid = files.filter((file) => {
      const supported = ["image/jpeg", "image/png"].includes(file.type) || (!file.type && /\.(jpe?g|png)$/i.test(file.name));
      if (!supported) { toast.error("Only JPG and PNG scans are supported right now."); return false; }
      if (!file.size || file.size > MAX_FILE_SIZE) { toast.error(file.size ? "Image is too large" : "This image is empty", { description: file.size ? `${file.name} exceeds 100MB.` : "Choose an image containing a scan." }); return false; }
      return true;
    });
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
    setFailure(false);
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

  const closeCamera = useCallback(() => {
    cameraSessionRef.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStream(null);
    setCameraOpen(false);
    setCameraReady(false);
    setCameraBusy(false);
    cameraDialogRef.current?.close();
  }, []);

  useEffect(() => () => {
    cameraSessionRef.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (cameraOpen && !cameraDialogRef.current?.open) cameraDialogRef.current?.showModal();
  }, [cameraOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraStream) return;
    video.srcObject = cameraStream;
    void video.play().catch(() => {
      setCameraError("The camera preview could not start. Close the camera and try again, or choose a saved photo.");
    });
  }, [cameraStream]);

  const openCamera = async () => {
    const session = ++cameraSessionRef.current;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStream(null);
    setCameraOpen(true);
    setCameraError("");
    setCameraBlocked(false);
    setCameraReady(false);
    setCameraBusy(true);
    const policyDocument = document as Document & { permissionsPolicy?: { allowsFeature: (feature: string) => boolean }; featurePolicy?: { allowsFeature: (feature: string) => boolean } };
    const policy = policyDocument.permissionsPolicy ?? policyDocument.featurePolicy;
    // A Next.js client navigation can retain the previous page's policy.
    // Offer a fresh document in another tab without discarding these scans.
    if (policy && !policy.allowsFeature("camera")) {
      setCameraBlocked(true);
      setCameraError("Camera access is blocked for this tab. Open the scanner in a new tab, then choose Use camera there. Your current scans stay in this tab.");
      setCameraBusy(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot show a live camera preview. Use your phone camera or choose a saved photo below.");
      setCameraBusy(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (session !== cameraSessionRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      setCameraStream(stream);
    } catch (error) {
      if (session !== cameraSessionRef.current) return;
      const name = error instanceof DOMException ? error.name : "";
      setCameraError(name === "NotAllowedError" ? "Camera permission was not granted. Allow camera access in your browser, then try again, or choose a saved photo." : name === "NotFoundError" ? "No camera was found. Connect a camera and try again, or choose a saved photo." : "The camera could not start. It may be in use by another app. Close it there and try again, or choose a saved photo.");
    } finally {
      if (session === cameraSessionRef.current) setCameraBusy(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || cameraBusy) return;
    const session = cameraSessionRef.current;
    setCameraBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) { setCameraError("The camera image could not be captured. Try again or choose a saved photo."); setCameraBusy(false); return; }
    context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      canvas.width = 0; canvas.height = 0;
      if (session !== cameraSessionRef.current) return;
      setCameraBusy(false);
      if (!blob) { setCameraError("The camera image could not be saved. Try again."); return; }
      addFiles([new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" })]);
      toast.success("Photo added to your scans");
    }, "image/jpeg", 0.95);
  };

  const markInvalid = useCallback((id: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, invalid: true } : item));
  }, []);

  const moveImage = useCallback((id: string, direction: -1 | 1) => {
    setItems((current) => {
      const from = current.findIndex((item) => item.id === id), to = from + direction;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const reordered = [...current];
      [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
      return reordered;
    });
    setResult(null);
  }, []);

  const canSave = items.length > 0 && items.every((item) => item.width > 0 && !item.invalid);

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
    cancel();
    setFailure(false);
    for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
    itemsRef.current = [];
    setItems([]);
    setResult(null);
    autoDownloadRef.current = false;
  }, [cancel]);

  const savePdf = () => {
    if (items.length === 0 || items.some((item) => item.invalid || !item.width)) return;
    setFailure(false);
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
        setFailure(true);
        console.error("Scan to PDF failed:", error);
        return "One image may be damaged or unsupported. Remove it and try again.";
      },
    });
  };

  const downloadResult = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);

  if (result) {
    return <PdfToolResultLayout toolSlug="scan-pdf"><ResultState resultFilename={result.filename} fileSize={formatFileSize(result.blob.size)} onDownload={downloadResult} downloadLabel={result.filename.endsWith(".zip") ? "Download ZIP" : "Download PDF"} onStartOver={clearAll} autoDownloadedRef={autoDownloadRef} /></PdfToolResultLayout>;
  }

  return (
    <>
      <dialog ref={cameraDialogRef} aria-labelledby="scan-camera-title" onCancel={closeCamera} onClose={() => { if (cameraOpen) closeCamera(); }} className="w-[calc(100%_-_2rem)] max-w-2xl rounded-3xl border bg-white p-5 text-slate-950 shadow-xl backdrop:bg-slate-950/60 dark:bg-slate-900 dark:text-white">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 id="scan-camera-title" className="text-xl font-bold">Scan with your camera</h2><button type="button" onClick={closeCamera} aria-label="Close camera" className="rounded-full p-2 focus-visible:ring-2 focus-visible:ring-orange-500"><X className="h-5 w-5" aria-hidden /></button></div>
        <p className="mb-4 text-sm text-muted-foreground">Position the document inside the preview. Each photo becomes a PDF page. Photos stay in your browser.</p>
        {cameraError && <div role="alert" className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{cameraError}</div>}
        {cameraBlocked && <a href={typeof window === "undefined" ? "/scan-pdf" : window.location.pathname} target="_blank" rel="noopener noreferrer" className="mb-4 inline-flex min-h-11 items-center rounded-xl border px-4 py-2 font-semibold focus-visible:ring-2 focus-visible:ring-orange-500">Open scanner in a new tab</a>}
        <video ref={videoRef} aria-label="Camera preview" autoPlay muted playsInline onLoadedData={() => setCameraReady(true)} className={cn("max-h-[45vh] w-full rounded-2xl bg-slate-950 object-contain", !cameraStream && "hidden")} />
        {cameraBusy && !cameraStream && <p role="status" className="py-6 text-center text-sm">Waiting for camera permission…</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          {cameraStream && <button type="button" disabled={!cameraReady || cameraBusy} onClick={capturePhoto} className="min-h-12 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-45 dark:bg-orange-500 dark:text-slate-950">{cameraBusy ? "Saving photo…" : "Take photo"}</button>}
          {cameraError && !cameraBlocked && <button type="button" onClick={openCamera} disabled={cameraBusy} className="min-h-12 rounded-xl border px-4 py-3 font-semibold disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-orange-500">Try camera again</button>}
          <button type="button" onClick={() => { closeCamera(); cameraInputRef.current?.click(); }} className="min-h-12 rounded-xl border px-4 py-3 font-semibold focus-visible:ring-2 focus-visible:ring-orange-500">Use phone camera or choose photo</button>
          <button type="button" onClick={closeCamera} className="min-h-12 rounded-xl border px-4 py-3 font-semibold focus-visible:ring-2 focus-visible:ring-orange-500">Done</button>
        </div>
        <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">{items.length} image{items.length === 1 ? "" : "s"} in your scan.</p>
      </dialog>
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
          onCamera={openCamera}
        />
      ) : (
        <div className="flex-1 bg-slate-50 dark:bg-slate-950">
          <PdfWorkspaceBar title="Scan to PDF" meta={<>{items.length} image{items.length === 1 ? "" : "s"} · {formatFileSize(totalBytes)}</>} actions={<>
            <button type="button" onClick={processing ? cancel : savePdf} disabled={!processing && !canSave} className="min-h-12 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-45 dark:bg-orange-500 dark:text-slate-950 lg:hidden">{processing ? "Cancel" : "Save to PDF"}</button>
            <PdfAddButton count={items.length} label="Add more files" onClick={dropzone.open} disabled={processing} accent="orange" />
            <button type="button" onClick={openCamera} disabled={processing} aria-label="Use camera" className="flex h-12 w-12 items-center justify-center rounded-full border bg-white focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-45 dark:bg-slate-900"><Camera className="h-5 w-5" aria-hidden /></button>
          </>} />
          <div className="container mx-auto grid max-w-[1500px] gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_400px]">
            <section
              {...dropzone.getRootProps()}
              className="relative flex min-h-[560px] min-w-0 flex-col rounded-3xl border border-slate-200 bg-white/70 p-5 focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900/45 lg:p-8"
              aria-label="Scan workspace. Drop more images anywhere in this area."
            >
              <input {...dropzone.getInputProps()} />
              {dropzone.isDragActive && (
                <div className="absolute inset-4 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-orange-500 bg-orange-50/95 text-center dark:bg-orange-950/80">
                  <div><Upload className="mx-auto h-10 w-10 text-orange-500" aria-hidden /><p className="mt-3 text-lg font-semibold">Drop to add more scans</p></div>
                </div>
              )}
              <p className="mb-5 text-sm text-muted-foreground">Move images earlier or later to set the PDF page order.</p>
              <div className="flex flex-1 items-center justify-center">
                <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,276px),1fr))] justify-items-center gap-8">
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
                      onInvalid={markInvalid}
                      onMove={moveImage}
                      total={items.length}
                    />
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={clearAll}
                disabled={processing}
                className="mt-6 self-start text-sm font-semibold text-orange-500 underline-offset-4 hover:underline disabled:opacity-50"
              >
                <UiText text="Reset all" />
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
              canSave={canSave}
              failure={failure}
            />
          </div>
        </div>
      )}
    </>
  );
}
