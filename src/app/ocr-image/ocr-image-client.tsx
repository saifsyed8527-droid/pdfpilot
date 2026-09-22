"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ImageIcon, Info, Scan, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import {
  PdfAddButton,
  PdfToolLanding,
  PdfToolResultLayout,
  PdfWorkspaceBar,
} from "@/components/tool/PdfToolChrome";
import { downloadBlob } from "@/lib/download-file";
import { recognizeText, exportOcrResult, type OcrExportFormat } from "@/lib/engines/ocr-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import { formatFileSize } from "@/lib/utils";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".bmp"];

interface OcrImageClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

const LANDING_COPY = {
  title: "OCR Image",
  description: "Extract text from a photo or screenshot while keeping the original image untouched.",
  buttonLabel: "Select image",
  dropLabel: "or drag and drop an image here",
  limitLabel: "Image up to 100MB",
};

interface OcrResult {
  blob: Blob;
  filename: string;
}

function ImagePreviewCard({
  file,
  previewUrl,
  imageError,
  onImageError,
  onRemove,
}: {
  file: File;
  previewUrl: string | null;
  imageError: boolean;
  onImageError: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="group relative flex min-h-[302px] w-[234px] flex-col rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] transition-shadow hover:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-slate-900">
      <div className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {formatFileSize(file.size)}
      </div>
      <span className="absolute left-2 top-2 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[11px] font-semibold text-white shadow">
        1
      </span>
      <div className="relative flex h-[236px] items-center justify-center overflow-hidden rounded-xl bg-muted">
        {previewUrl && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview of the selected image
          <img src={previewUrl} alt="" className="h-full w-full object-contain" onError={onImageError} />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden />
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          title="Remove this file"
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border bg-white/95 text-destructive opacity-100 shadow transition-opacity hover:bg-destructive hover:text-destructive-foreground md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 dark:bg-slate-800/95"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className="mt-2 min-w-0 border-t border-slate-100 pt-2 dark:border-slate-800">
        <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
    </article>
  );
}

export function OcrImageClient({}: OcrImageClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [format, setFormat] = useState<OcrExportFormat>("txt");
  const [result, setResult] = useState<OcrResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoDownloadRef = useRef(false);
  const [ocrFailed, setOcrFailed] = useState(false);
  const { processing, progress, run } = useProcessingTask();

  const chooseFile = useCallback((files: File[]) => {
    const next = files.find(
      (candidate) =>
        ACCEPTED_TYPES.includes(candidate.type) ||
        ACCEPTED_EXTENSIONS.some((ext) => candidate.name.toLowerCase().endsWith(ext))
    );
    if (!next) {
      toast.error("Please choose an image file.");
      return;
    }
    if (next.size > MAX_FILE_SIZE) {
      toast.error("Image is too large", { description: "Please choose a file under 100MB." });
      return;
    }

    setFile(next);
    setImageError(false);
    setOcrFailed(false);
    setResult(null);
    autoDownloadRef.current = false;
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clear = useCallback(() => {
    setFile(null);
    setImageError(false);
    setOcrFailed(false);
    setResult(null);
    autoDownloadRef.current = false;
  }, []);

  const extractText = () => {
    if (!file || imageError) return;

    setOcrFailed(false);
    run(
      async (setProgress) => {
        setResult(null);
        autoDownloadRef.current = false;
        const { text } = await recognizeText(file, setProgress);

        if (!text.trim()) {
          throw new Error(
            "No text could be recognized in this image. It may not contain any text, or the image quality may be too low."
          );
        }

        const blob = await exportOcrResult(text, format);
        setProgress(100);
        setResult({ blob, filename: format === "docx" ? "extracted-text.docx" : "extracted-text.txt" });
      },
      {
        successMessage: "Text extracted successfully!",
        toolName: "ocr-image",
        errorTitle: "Failed to extract text",
        onError: (error) => {
          console.error("Error running OCR:", error);
          setOcrFailed(true);
          return error instanceof Error ? error.message : "Please try again with a valid image file";
        },
      }
    );
  };

  const downloadResult = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="ocr-image">
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={downloadResult}
          downloadLabel={format === "docx" ? "Download Word document" : "Download text file"}
          onStartOver={clear}
          autoDownloadedRef={autoDownloadRef}
        />
      </PdfToolResultLayout>
    );
  }

  if (!file) {
    return (
      <PdfToolLanding
        title={LANDING_COPY.title}
        description={LANDING_COPY.description}
        buttonLabel={LANDING_COPY.buttonLabel}
        dropLabel={LANDING_COPY.dropLabel}
        limitLabel={LANDING_COPY.limitLabel}
        accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"], "image/bmp": [".bmp"] }}
        multiple={false}
        icon={Scan}
        iconClass="text-orange-600"
        iconBackgroundClass="bg-orange-100 dark:bg-orange-950/40"
        accent="orange"
        onFilesSelected={chooseFile}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-slate-50 dark:bg-slate-950">
      <PdfWorkspaceBar
        title="OCR Image"
        meta={<>{file.name} · {formatFileSize(file.size)}</>}
        actions={
          <PdfAddButton
            count={1}
            label="Replace image"
            accent="orange"
            disabled={processing}
            onClick={() => inputRef.current?.click()}
          />
        }
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/bmp,.jpg,.jpeg,.png,.webp,.bmp"
        className="hidden"
        onChange={(event) => {
          chooseFile(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />

      <div className="container mx-auto grid max-w-[1500px] flex-1 gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="relative flex min-h-[560px] items-center justify-center rounded-3xl border border-slate-200 bg-white/70 p-8 dark:border-slate-800 dark:bg-slate-900/45">
          <ImagePreviewCard
            file={file}
            previewUrl={previewUrl}
            imageError={imageError}
            onImageError={() => setImageError(true)}
            onRemove={clear}
          />
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center gap-3 border-b pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
              <Scan className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Extract text from image</h2>
              <p className="text-xs text-muted-foreground">English printed text</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                Ready for OCR
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Text will be recognized from your image and saved as a separate file.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <label htmlFor="ocr-image-format" className="text-sm font-medium">Output format</label>
              <Select value={format} onValueChange={(v) => setFormat(v as OcrExportFormat)}>
                <SelectTrigger id="ocr-image-format" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="txt">Plain text (.txt)</SelectItem>
                  <SelectItem value="docx">Word document (.docx)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>Best results come from clear, upright images with readable printed text.</p>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>Recognition runs in your browser. Your image is not uploaded.</p>
            </div>

            {imageError && (
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>This image could not be read. Remove it and choose another file.</p>
              </div>
            )}

            {ocrFailed && (
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>OCR did not finish. Your original image is safe; try again or use a clearer image.</p>
              </div>
            )}
          </div>

          {processing ? (
            <div className="mt-5">
              <ProcessingState progress={progress} label="Recognizing text…" cancelable={false} />
            </div>
          ) : (
            <button
              type="button"
              onClick={extractText}
              disabled={imageError}
              className="mt-6 flex min-h-16 w-full items-center justify-center rounded-2xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0 dark:bg-orange-500 dark:text-slate-950"
            >
              {ocrFailed ? "Try Again" : "Extract text"}
            </button>
          )}
          <p className="mt-3 text-center text-xs text-slate-500">Browser-local OCR · nothing is uploaded</p>
        </aside>
      </div>
    </div>
  );
}
