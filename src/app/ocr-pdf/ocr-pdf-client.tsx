"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Info, ScanText, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import {
  PdfAddButton,
  PdfToolLanding,
  PdfToolResultLayout,
  PdfWorkspaceBar,
} from "@/components/tool/PdfToolChrome";
import { downloadBlob } from "@/lib/download-file";
import { createSearchableOcrPdf, type SearchableOcrPdfResult } from "@/lib/engines/ocr-engine";
import { renderFirstPageThumbnailWithInfo } from "@/lib/engines/pdf-render-engine";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import { formatFileSize } from "@/lib/utils";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

interface OcrOutput extends SearchableOcrPdfResult {
  filename: string;
}

const LANDING_COPY = {
  title: "OCR PDF",
  description: "Turn scanned PDFs into searchable documents while keeping every page looking like the original.",
  buttonLabel: "Select PDF file",
  dropLabel: "or drag and drop a PDF file here",
  limitLabel: "PDF up to 100MB",
};

function PdfPreviewCard({
  file,
  pageCount,
  thumbnail,
  onRemove,
}: {
  file: File;
  pageCount?: number;
  thumbnail?: string | null;
  onRemove: () => void;
}) {
  return (
    <article className="group relative flex min-h-[302px] w-[234px] flex-col rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] transition-shadow hover:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-slate-900">
      <div className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {formatFileSize(file.size)}
        {pageCount ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}
      </div>
      <span className="absolute left-2 top-2 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[11px] font-semibold text-white shadow">
        1
      </span>
      <div className="relative flex h-[236px] items-center justify-center overflow-hidden rounded-xl bg-muted">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- local canvas snapshot preview
          <img src={thumbnail} alt="" className="h-full w-full object-contain" />
        ) : thumbnail === null ? (
          <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
        ) : (
          <div className="h-full w-full animate-pulse bg-muted-foreground/10" aria-hidden />
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
        <p className="text-xs text-muted-foreground">
          {pageCount === undefined ? "Reading PDF…" : `${pageCount} page${pageCount === 1 ? "" : "s"}`}
          {" · "}
          {formatFileSize(file.size)}
        </p>
      </div>
    </article>
  );
}

export function OcrPdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null | undefined>(undefined);
  const [pageCount, setPageCount] = useState<number | undefined>(undefined);
  const [previewError, setPreviewError] = useState(false);
  const [ocrFailed, setOcrFailed] = useState(false);
  const [result, setResult] = useState<OcrOutput | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask();

  const chooseFile = useCallback((files: File[]) => {
    const next = files.find((candidate) => candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf"));
    if (!next) {
      toast.error("Please choose a PDF file.");
      return;
    }
    if (next.size > MAX_FILE_SIZE) {
      toast.error("PDF is too large", { description: "Please choose a file under 100MB." });
      return;
    }

    setFile(next);
    setThumbnail(undefined);
    setPageCount(undefined);
    setPreviewError(false);
    setOcrFailed(false);
    setResult(null);
    autoDownloadRef.current = false;
  }, []);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;

    renderFirstPageThumbnailWithInfo(file)
      .then(({ thumbnail: nextThumbnail, pageCount: nextPageCount }) => {
        if (cancelled) return;
        setThumbnail(nextThumbnail);
        setPageCount(nextPageCount);
      })
      .catch(() => {
        if (cancelled) return;
        setThumbnail(null);
        setPreviewError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  const clear = useCallback(() => {
    setFile(null);
    setThumbnail(undefined);
    setPageCount(undefined);
    setPreviewError(false);
    setOcrFailed(false);
    setResult(null);
    autoDownloadRef.current = false;
  }, []);

  const runOcr = () => {
    if (!file || previewError) return;

    setOcrFailed(false);
    run(
      async (setProgress, isCancelled) => {
        setResult(null);
        autoDownloadRef.current = false;
        const output = await createSearchableOcrPdf(file, setProgress, isCancelled);
        if (!output || isCancelled()) return;
        setResult({ ...output, filename: `${safeBaseName(file.name)}_searchable.pdf` });
      },
      {
        successMessage: "Searchable PDF created successfully!",
        toolName: "ocr-pdf",
        errorTitle: "Could not recognize this PDF",
        onError: (error) => {
          setOcrFailed(true);
          return error instanceof Error ? error.message : "Try a cleaner scan or another PDF.";
        },
      }
    );
  };

  const downloadResult = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="ocr-pdf">
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={downloadResult}
          downloadLabel="Download searchable PDF"
          onStartOver={clear}
          autoDownloadedRef={autoDownloadRef}
        />
        <div className="mx-auto -mt-2 max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Text was recognized on {result.pageCount} page{result.pageCount === 1 ? "" : "s"}. The original page appearance is preserved.
        </div>
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
        accept={{ "application/pdf": [".pdf"] }}
        multiple={false}
        icon={ScanText}
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
        title="OCR PDF"
        meta={<>{file.name} · {pageCount ?? "…"} page{pageCount === 1 ? "" : "s"} · {formatFileSize(file.size)}</>}
        actions={
          <PdfAddButton
            count={1}
            label="Replace PDF file"
            accent="orange"
            disabled={processing}
            onClick={() => inputRef.current?.click()}
          />
        }
      />
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          chooseFile(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />

      <div className="container mx-auto grid max-w-[1500px] flex-1 gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="relative flex min-h-[560px] items-center justify-center rounded-3xl border border-slate-200 bg-white/70 p-8 dark:border-slate-800 dark:bg-slate-900/45">
          <PdfPreviewCard file={file} pageCount={pageCount} thumbnail={thumbnail} onRemove={clear} />
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center gap-3 border-b pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
              <ScanText className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Make text searchable</h2>
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
                The document stays visually unchanged while a searchable text layer is added.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>Best results come from clear scans with upright, printed English text.</p>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>Recognition runs in your browser. Your PDF is not uploaded.</p>
            </div>

            {previewError && (
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>This PDF could not be read. Remove it and choose another file.</p>
              </div>
            )}

            {ocrFailed && (
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>OCR did not finish. Your original PDF is safe; try again or use a clearer scan.</p>
              </div>
            )}
          </div>

          {processing ? (
            <div className="mt-5">
              <ProcessingState progress={progress} label="Recognizing text…" onCancel={cancel} />
            </div>
          ) : (
            <button
              type="button"
              onClick={runOcr}
              disabled={previewError}
              className="mt-6 flex min-h-16 w-full items-center justify-center rounded-2xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0 dark:bg-orange-500 dark:text-slate-950"
            >
              {ocrFailed ? "Try Again" : "Make PDF searchable"}
            </button>
          )}
          <p className="mt-3 text-center text-xs text-slate-500">Browser-local OCR · nothing is uploaded</p>
        </aside>
      </div>
    </div>
  );
}
