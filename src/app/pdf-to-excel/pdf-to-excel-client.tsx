"use client";

import { useEffect, useRef, useState } from "react";
import { useDropzone, type Accept, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRightCircle,
  Check,
  Cloud,
  Download,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Info,
  Link as LinkIcon,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
import { cn, formatFileSize } from "@/lib/utils";
import { downloadBlob } from "@/lib/download-file";
import { renderFirstPageThumbnailWithInfo } from "@/lib/engines/pdf-render-engine";
import { createExcelFromPdfTables, type ExcelSheetLayout } from "@/lib/engines/pdf-table-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import { ProcessingState } from "@/components/tool/ProcessingState";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const PDF_ACCEPT: Accept = { "application/pdf": [".pdf"] };

interface PdfToExcelClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

interface ExcelResult {
  blob: Blob;
  filename: string;
  tablePageCount: number;
  totalRows: number;
}

function CloudFileButton({ label, icon: Icon }: { label: string; icon: typeof Cloud }) {
  return (
    <div className="group/cloud relative">
      <button
        type="button"
        onClick={() => toast.info(`${label} is not connected yet. Use the local file picker for now.`)}
        aria-label={label}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
      >
        <Icon className="h-5 w-5" aria-hidden />
      </button>
      <span className="pointer-events-none absolute left-14 top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-800 px-3 py-2 text-xs font-bold text-white opacity-0 shadow-xl transition-opacity before:absolute before:-left-1 before:top-1/2 before:h-2 before:w-2 before:-translate-y-1/2 before:rotate-45 before:bg-slate-800 group-hover/cloud:opacity-100 group-focus-within/cloud:opacity-100">
        {label}
      </span>
    </div>
  );
}

function Landing({
  onFilesSelected,
}: {
  onFilesSelected: (files: File[]) => void;
}) {
  const onRejected = (rejections: FileRejection[]) => {
    const tooLarge = rejections.some((rejection) => rejection.errors.some((error) => error.code === "file-too-large"));
    toast.error(tooLarge ? "Each PDF must be 100MB or smaller." : "Please choose a PDF file.");
  };

  const dropzone = useDropzone({
    accept: PDF_ACCEPT,
    multiple: false,
    maxSize: MAX_FILE_SIZE,
    onDropAccepted: onFilesSelected,
    onDropRejected: onRejected,
  });

  return (
    <div className="flex flex-1 flex-col bg-[#f7f7fb] dark:bg-slate-950">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-24 pt-12 text-center md:pt-14">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-6xl">
          Convert PDF to EXCEL
        </h1>
        <p className="mt-5 text-xl text-slate-600 dark:text-slate-300 md:text-2xl">
          Convert PDF Data to EXCEL Spreadsheets.
        </p>
        <p className="mt-2 text-base text-slate-500">
          Powered by <span className="text-red-600">PDFPilot</span>.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <div
            {...dropzone.getRootProps({ role: "button", "aria-label": "Select PDF file or drop PDF here" })}
            className={cn("cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-4", dropzone.isDragActive && "ring-2 ring-red-500 ring-offset-4")}
          >
            <input {...dropzone.getInputProps()} />
            <div className="flex min-h-[108px] min-w-[440px] items-center justify-center rounded-xl bg-red-600 px-10 py-7 text-3xl font-bold text-white shadow-[0_10px_24px_-14px_rgba(185,28,28,0.8)] transition hover:bg-red-700 max-sm:min-w-0 max-sm:text-2xl">
              {dropzone.isDragActive ? "Drop PDF here" : "Select PDF file"}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <CloudFileButton label="Select PDF from Google Drive" icon={HardDrive} />
            <CloudFileButton label="Select PDF from Dropbox" icon={Cloud} />
          </div>
        </div>
        <p className="mt-5 text-lg text-slate-500">or drop PDF here</p>
      </section>
    </div>
  );
}

function FileCard({ file, pageCount, thumbnail, onRemove }: { file: File; pageCount?: number; thumbnail?: string | null; onRemove: () => void }) {
  return (
    <article className="group relative flex min-h-[326px] w-[264px] flex-col rounded-lg bg-white p-4 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.45)] dark:bg-slate-900">
      <div className="relative flex h-[248px] items-center justify-center bg-white dark:bg-slate-950">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- local canvas snapshot preview
          <img src={thumbnail} alt="" className="max-h-full max-w-full object-contain shadow-[0_8px_24px_-18px_rgba(15,23,42,0.7)]" />
        ) : thumbnail === null ? (
          <FileText className="h-12 w-12 text-slate-400" aria-hidden />
        ) : (
          <div className="h-full w-36 animate-pulse rounded bg-slate-100 dark:bg-slate-800" aria-hidden />
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          title="Remove this file"
          className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-600 opacity-0 shadow transition hover:bg-red-600 hover:text-white group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-800"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="mt-3 min-w-0 text-center">
        <p className="truncate text-base text-slate-700 dark:text-slate-200" title={file.name}>{file.name}</p>
        <p className="mt-1 text-xs text-slate-500">
          {pageCount === undefined ? "Reading PDF..." : `${pageCount} page${pageCount === 1 ? "" : "s"}`} · {formatFileSize(file.size)}
        </p>
      </div>
    </article>
  );
}

function AddMoreButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <div className="group/add absolute right-8 top-20 z-20">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label="Add more files"
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <Plus className="h-8 w-8" aria-hidden />
        <span className="absolute -left-2 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-950 px-1 text-xs font-bold text-white ring-2 ring-red-600">
          1
        </span>
      </button>
      <span className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-800 px-3 py-2 text-sm font-bold text-white opacity-0 shadow-xl transition-opacity after:absolute after:-right-1 after:top-1/2 after:h-2 after:w-2 after:-translate-y-1/2 after:rotate-45 after:bg-slate-800 group-hover/add:opacity-100 group-focus-within/add:opacity-100">
        Add more files
      </span>
    </div>
  );
}

function OcrOption({ selected }: { selected?: boolean }) {
  return (
    <div className={cn("border-b border-slate-200 px-8 py-7 dark:border-slate-800", selected ? "bg-[#eeeeF7] dark:bg-slate-800/65" : "bg-white dark:bg-slate-900")}>
      <div className="flex items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xl font-medium text-red-500">NO OCR</p>
          </div>
          <p className="mt-1 text-xl leading-7 text-slate-600 dark:text-slate-300">
            Convert PDFs with selectable text into editable Excel files.
          </p>
        </div>
        {selected && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-5 w-5" aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}

function PremiumOcrOption() {
  return (
    <div className="border-b border-slate-200 bg-white px-8 py-7 opacity-80 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <p className="text-xl font-medium text-red-500">OCR</p>
        <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Premium</span>
      </div>
      <p className="mt-1 text-xl leading-7 text-slate-600 dark:text-slate-300">
        Convert scanned PDFs with non-selectable text into editable Excel files.
      </p>
    </div>
  );
}

function LayoutSelector({ value, onChange, disabled }: { value: ExcelSheetLayout; onChange: (layout: ExcelSheetLayout) => void; disabled?: boolean }) {
  return (
    <div className="px-8 py-8">
      <div className="mb-4 flex items-center gap-2">
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">Layout:</p>
        <div className="group/info relative">
          <Info className="h-5 w-5 cursor-help text-red-500" aria-hidden />
          <span className="pointer-events-none absolute bottom-8 left-1/2 z-20 w-[440px] max-w-[72vw] -translate-x-1/2 rounded-md bg-slate-800 px-4 py-3 text-center text-sm font-bold leading-5 text-white opacity-0 shadow-xl transition-opacity after:absolute after:-bottom-1 after:left-1/2 after:h-2 after:w-2 after:-translate-x-1/2 after:rotate-45 after:bg-slate-800 group-hover/info:opacity-100 group-focus-within/info:opacity-100">
            Choose to place all tables on one sheet, or create a new sheet for each table page.
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Excel layout">
        {[
          ["one-sheet", "One sheet"],
          ["multiple-sheets", "Multiple sheets"],
        ].map(([id, label]) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(id as ExcelSheetLayout)}
              className={cn(
                "min-h-20 rounded-lg border-2 px-4 text-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50",
                selected ? "border-red-500 bg-white text-red-500 shadow-sm dark:bg-slate-950" : "border-transparent bg-[#f6f6fb] text-slate-400 dark:bg-slate-800"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultScreen({ result, onDownload, onStartOver, autoDownloadedRef }: { result: ExcelResult; onDownload: () => void; onStartOver: () => void; autoDownloadedRef: React.MutableRefObject<boolean> }) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (!autoDownloadedRef.current) {
      autoDownloadedRef.current = true;
      onDownload();
    }
  }, [autoDownloadedRef, onDownload]);

  return (
    <div className="flex flex-1 flex-col bg-[#f7f7fb] px-4 py-10 text-center dark:bg-slate-950 md:py-14">
      <h1 className="mx-auto max-w-5xl text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">
        Your PDF has been converted to an editable EXCEL spreadsheet
      </h1>
      <div className="mt-10 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={onStartOver}
          aria-label="Convert another PDF"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-white shadow-lg transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-6 w-6" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="flex min-h-[108px] min-w-[440px] items-center justify-center gap-4 rounded-xl bg-red-600 px-10 py-7 text-3xl font-bold text-white shadow-[0_10px_24px_-14px_rgba(185,28,28,0.8)] transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-4 max-sm:min-w-0 max-sm:text-2xl"
        >
          <Download className="h-8 w-8" aria-hidden />
          Download EXCEL
        </button>
        <div className="grid grid-cols-2 gap-3">
          <CloudFileButton label="Save to Google Drive" icon={HardDrive} />
          <CloudFileButton label="Copy download link" icon={LinkIcon} />
          <CloudFileButton label="Save to Dropbox" icon={Cloud} />
          <button
            type="button"
            onClick={onStartOver}
            aria-label="Delete file and start over"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            <Trash2 className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-4xl rounded-lg border-2 border-sky-200 bg-white px-5 py-4 text-left text-sm text-slate-600 dark:border-sky-900 dark:bg-slate-900 dark:text-slate-300">
        <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          <Info className="h-4 w-4" aria-hidden />
        </span>
        Created <strong>{result.filename}</strong> with {result.totalRows} row{result.totalRows === 1 ? "" : "s"} from {result.tablePageCount} PDF page{result.tablePageCount === 1 ? "" : "s"}.
      </div>
      <div className="mx-auto mt-4 w-full max-w-4xl rounded-lg border-2 border-sky-200 bg-sky-50 p-8 text-left dark:border-sky-900 dark:bg-sky-950/30">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Secure. Private. In your control</h2>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
          Your PDF was converted locally in this browser. Files are not uploaded, stored, tracked, or sent to a server.
        </p>
      </div>
    </div>
  );
}

export function PdfToExcelClient({ faqs: _faqs, related: _related }: PdfToExcelClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null | undefined>(undefined);
  const [pageCount, setPageCount] = useState<number | undefined>(undefined);
  const [layout, setLayout] = useState<ExcelSheetLayout>("multiple-sheets");
  const [result, setResult] = useState<ExcelResult | null>(null);
  const [processingLabel, setProcessingLabel] = useState("Converting PDF to Excel...");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask();

  useEffect(() => {
    if (!file) return;
    let alive = true;
    setThumbnail(undefined);
    setPageCount(undefined);
    renderFirstPageThumbnailWithInfo(file, 0.34)
      .then((info) => {
        if (!alive) return;
        setThumbnail(info.thumbnail);
        setPageCount(info.pageCount);
      })
      .catch(() => {
        if (!alive) return;
        setThumbnail(null);
      });
    return () => {
      alive = false;
    };
  }, [file]);

  const chooseFile = (files: File[]) => {
    const next = files[0];
    if (!next) return;
    window.scrollTo({ top: 0 });
    setFile(next);
    setResult(null);
    autoDownloadRef.current = false;
  };

  const clear = () => {
    setFile(null);
    setThumbnail(undefined);
    setPageCount(undefined);
    setResult(null);
    autoDownloadRef.current = false;
  };

  const convertToExcel = () => {
    if (!file) return;
    run(
      async (setProgress, isCancelled) => {
        setResult(null);
        autoDownloadRef.current = false;
        setProcessingLabel("Detecting table structure...");
        const nextResult = await createExcelFromPdfTables(file, layout, (page, total) => {
          setProcessingLabel(`Reading page ${page} of ${total}...`);
          setProgress(8 + (page / total) * 72);
        });
        if (isCancelled()) return;
        setProcessingLabel("Creating Excel spreadsheet...");
        setProgress(94);
        setResult(nextResult);
        setProgress(100);
      },
      {
        successMessage: "Converted to Excel successfully!",
        toolName: "pdf-to-excel",
        errorTitle: "Failed to convert to Excel",
        onError: (error) => {
          console.error("Error converting PDF to Excel:", error);
          const message = error instanceof Error ? error.message : "";
          return message.includes("is encrypted")
            ? "This PDF is password-protected. Please remove the password and try again."
            : message || "Please try again with a PDF that has selectable table text.";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  };

  if (!file && !result) {
    return <Landing onFilesSelected={chooseFile} />;
  }

  if (result) {
    return <ResultScreen result={result} onDownload={downloadResult} onStartOver={clear} autoDownloadedRef={autoDownloadRef} />;
  }

  return (
    <div className="grid flex-1 bg-[#f7f7fb] dark:bg-slate-950 lg:grid-cols-[minmax(0,1fr)_430px]">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => chooseFile(Array.from(event.target.files ?? []))} />

      <section className="relative flex min-h-[680px] items-center justify-center px-6 py-12">
        <AddMoreButton disabled={processing} onClick={() => inputRef.current?.click()} />
        {file && <FileCard file={file} pageCount={pageCount} thumbnail={thumbnail} onRemove={clear} />}
      </section>

      <aside className="flex min-h-[680px] flex-col border-l border-slate-200 bg-white shadow-[-12px_0_42px_-38px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-8 py-8 text-center dark:border-slate-800">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/30">
            <FileSpreadsheet className="h-6 w-6" aria-hidden />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">PDF to Excel</h2>
        </div>

        <div className="px-8 py-6">
          <div className="flex gap-4 rounded-lg bg-sky-100 px-5 py-4 text-base leading-6 text-slate-700 dark:bg-sky-950/40 dark:text-slate-200">
            <Info className="mt-1 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
            <p>
              Looks like you are trying to process a PDF containing some scanned pages. To extract all text from your file, <span className="font-bold underline">OCR</span> is needed.
            </p>
          </div>
        </div>

        <OcrOption selected />
        <PremiumOcrOption />
        <LayoutSelector value={layout} onChange={setLayout} disabled={processing} />

        <div className="mt-auto px-8 pb-8 pt-3">
          {processing ? (
            <ProcessingState progress={progress} label={processingLabel} onCancel={cancel} />
          ) : (
            <button
              type="button"
              onClick={convertToExcel}
              className="flex min-h-[108px] w-full items-center justify-center gap-4 rounded-xl bg-red-600 px-7 py-6 text-3xl font-bold text-white shadow-[0_10px_24px_-14px_rgba(185,28,28,0.8)] transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-4"
            >
              Convert to EXCEL
              <ArrowRightCircle className="h-8 w-8" aria-hidden />
            </button>
          )}
          <p className="mt-4 text-center text-xs text-slate-500">
            Browser-local conversion. Best for selectable table text.
          </p>
        </div>
      </aside>
    </div>
  );
}
