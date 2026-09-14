"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import Link from "next/link";
import { useDropzone, type FileRejection } from "react-dropzone";
import { ArrowLeft, ArrowRight, FileText, Info, Plus, ShieldCheck, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { ResultState } from "@/components/tool/ResultState";
import { TrustSection } from "@/components/tool/TrustSection";
import { getCrossSellTools } from "@/lib/cross-sell";
import { downloadBlob } from "@/lib/download-file";
import { repairPdf, type PdfRepairResult } from "@/lib/engines/pdf-engine";
import { renderFirstPageThumbnailWithInfo } from "@/lib/engines/pdf-render-engine";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import { cn, formatFileSize } from "@/lib/utils";

const ACCEPTED_PDF = { "application/pdf": [".pdf"] };
const MAX_FILE_SIZE = 100 * 1024 * 1024;

interface RepairOutput extends PdfRepairResult {
  filename: string;
}

function BackToHome() {
  return (
    <Link href="/" className="mb-7 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Home
    </Link>
  );
}

function Landing({
  dragActive,
  getRootProps,
  getInputProps,
}: {
  dragActive: boolean;
  getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
  getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
}) {
  return (
    <div className="flex flex-1 bg-[#f7f7fb] py-10 dark:bg-slate-950/50 md:py-14">
      <div className="container mx-auto flex max-w-6xl flex-1 flex-col px-4">
        <BackToHome />
        <section className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white">Repair PDF file</h1>
          <p className="mt-5 max-w-4xl text-xl leading-9 text-slate-600 dark:text-slate-300">
            Upload a corrupt PDF and we will try to fix it. Depending on how much the PDF is damaged, we may recover it partially or completely.
          </p>
          <div
            {...getRootProps({ role: "button", "aria-label": "Select PDF file or drop PDF here" })}
            className={cn(
              "mt-9 flex w-full max-w-xl cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white p-5 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.62)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-slate-900",
              dragActive ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-transparent hover:border-red-300"
            )}
          >
            <input {...getInputProps()} />
            <span className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-xl bg-red-500 px-8 py-4 text-xl font-bold text-white shadow-lg transition hover:bg-red-600">
              <Upload className="h-6 w-6" aria-hidden />
              {dragActive ? "Drop PDF here" : "Select PDF file"}
            </span>
            <span className="mt-4 text-sm text-slate-500">or drop PDF here</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden /> Files stay on your device</span>
            <span>100MB max per PDF</span>
            <span>No account needed</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function PdfCard({
  file,
  thumbnail,
  onRemove,
  processing,
}: {
  file: File;
  thumbnail: string | null | undefined;
  onRemove: () => void;
  processing: boolean;
}) {
  return (
    <article className="group/card relative flex h-[326px] w-[276px] flex-col items-center justify-center rounded-lg bg-white p-4 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.65)] ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      <div className="pointer-events-none absolute -top-10 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
        {formatFileSize(file.size)}
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={processing}
        aria-label={`Remove ${file.name}`}
        className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 opacity-100 shadow-md ring-1 ring-slate-200 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 md:opacity-0 md:group-hover/card:opacity-100 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <div className="flex h-[235px] w-[180px] items-center justify-center overflow-hidden bg-white shadow-md">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- canvas snapshot from local PDF
          <img src={thumbnail} alt="" className="h-full w-full object-contain" />
        ) : thumbnail === null ? (
          <FileText className="h-12 w-12 text-slate-400" aria-hidden />
        ) : (
          <div className="h-full w-full animate-pulse bg-slate-100" aria-hidden />
        )}
      </div>
      <p className="mt-4 w-full truncate text-center text-sm font-medium text-slate-600 dark:text-slate-300" title={file.name}>
        {file.name}
      </p>
    </article>
  );
}

function FloatingButton({
  label,
  count,
  disabled,
  onClick,
  children,
}: {
  label: string;
  count?: number;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="group/floating relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50"
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

function RepairPanel({
  file,
  processing,
  progress,
  onRepair,
  onCancel,
}: {
  file: File;
  processing: boolean;
  progress: number;
  onRepair: () => void;
  onCancel: () => void;
}) {
  return (
    <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-5.15rem)] lg:min-h-[640px] lg:border-l lg:p-6">
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-6 border-b pb-5 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Repair PDF</h2>
        </div>
        <div className="rounded-xl bg-sky-100 px-4 py-4 text-left text-sm leading-6 text-slate-800 dark:bg-sky-950/40 dark:text-slate-100">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" aria-hidden />
            <p>
              We will try to repair your PDF. You can get a different file format on download if we detect that format in your file.
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white" title={file.name}>{file.name}</p>
          <p className="mt-1 text-xs text-slate-500">{formatFileSize(file.size)}</p>
        </div>
        <div className="flex-1" />
        {processing ? (
          <ProcessingState progress={progress} label="Trying to repair PDF..." onCancel={onCancel} />
        ) : (
          <button
            type="button"
            onClick={onRepair}
            className="flex min-h-16 w-full items-center justify-center gap-3 rounded-xl bg-red-500 px-6 py-4 text-xl font-bold text-white shadow-lg transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            Repair PDF <ArrowRight className="h-6 w-6" aria-hidden />
          </button>
        )}
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
  result: RepairOutput;
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
            downloadLabel="Download file"
            onStartOver={onStartOver}
            autoDownloadedRef={autoDownloadRef}
          />
          <p className="mt-4 text-center text-xs text-slate-500">
            Recovered {result.pageCount} page{result.pageCount === 1 ? "" : "s"} using a {result.method === "rebuilt" ? "rebuilt" : "re-saved"} PDF structure.
          </p>
        </section>
        <RelatedTools title="Continue with your PDF" tools={getCrossSellTools("repair-pdf")} />
        <TrustSection />
      </div>
    </div>
  );
}

export function RepairPdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null | undefined>(undefined);
  const [result, setResult] = useState<RepairOutput | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask();

  const addFiles = useCallback((files: File[]) => {
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
    setResult(null);
    autoDownloadRef.current = false;
  }, []);

  const reportRejections = useCallback((rejections: FileRejection[]) => {
    for (const rejection of rejections) {
      for (const error of rejection.errors) {
        toast.error(error.code === "file-too-large" ? "PDF is too large" : "Could not add PDF", {
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
    accept: ACCEPTED_PDF,
    multiple: false,
    maxSize: MAX_FILE_SIZE,
    noClick: !!file,
    noKeyboard: !!file,
    disabled: processing,
  });

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setThumbnail(undefined);
    renderFirstPageThumbnailWithInfo(file)
      .then(({ thumbnail }) => {
        if (!cancelled) setThumbnail(thumbnail);
      })
      .catch(() => {
        if (!cancelled) setThumbnail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const clear = () => {
    setFile(null);
    setThumbnail(undefined);
    setResult(null);
    autoDownloadRef.current = false;
  };

  const runRepair = () => {
    if (!file) return;
    run(async (setProgress, isCancelled) => {
      setResult(null);
      autoDownloadRef.current = false;
      const output = await repairPdf(file, setProgress, isCancelled);
      if (!output || isCancelled()) return;
      setResult({
        ...output,
        filename: `${safeBaseName(file.name)}_repaired.pdf`,
      });
    }, {
      successMessage: "Your repaired PDF is ready!",
      toolName: "repair-pdf",
      errorTitle: "Could not repair this PDF",
      onError: (error) => error instanceof Error ? error.message : "Try another copy of this PDF if you have one.",
    });
  };

  const downloadResult = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);

  if (result) {
    return <ResultView result={result} onDownload={downloadResult} onStartOver={clear} autoDownloadRef={autoDownloadRef} />;
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          addFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      {!file ? (
        <Landing dragActive={dropzone.isDragActive} getRootProps={dropzone.getRootProps} getInputProps={dropzone.getInputProps} />
      ) : (
        <div className="flex-1 bg-[#f7f7fb] dark:bg-slate-950/50">
          <div className="grid min-h-[calc(100vh-5.15rem)] lg:grid-cols-[minmax(0,1fr)_420px]">
            <section
              {...dropzone.getRootProps()}
              className="relative flex min-h-[620px] flex-col p-5 focus-visible:outline-none lg:p-8"
              aria-label="Repair PDF workspace. Drop another PDF here to replace the selected file."
            >
              <input {...dropzone.getInputProps()} />
              {dropzone.isDragActive && (
                <div className="absolute inset-4 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-red-500 bg-red-50/95 text-center dark:bg-red-950/80">
                  <div><Upload className="mx-auto h-10 w-10 text-red-500" aria-hidden /><p className="mt-3 text-lg font-semibold">Drop to replace PDF</p></div>
                </div>
              )}
              <div className="mb-6 flex items-center justify-end">
                <FloatingButton count={1} label="Add more files" disabled={processing} onClick={() => fileInputRef.current?.click()}>
                  <Plus className="h-7 w-7" aria-hidden />
                </FloatingButton>
              </div>
              <div className="flex flex-1 items-center justify-center">
                <PdfCard file={file} thumbnail={thumbnail} onRemove={clear} processing={processing} />
              </div>
            </section>
            <RepairPanel file={file} processing={processing} progress={progress} onRepair={runRepair} onCancel={cancel} />
          </div>
        </div>
      )}
    </>
  );
}
