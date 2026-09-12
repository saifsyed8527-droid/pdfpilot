"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, FileSpreadsheet, FileText, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { PdfAddButton, PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ResultState } from "@/components/tool/ResultState";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
import { getCategoryStyle } from "@/lib/category-colors";
import { cn, formatFileSize } from "@/lib/utils";
import { downloadBlob } from "@/lib/download-file";
import { renderFirstPageThumbnailWithInfo } from "@/lib/engines/pdf-render-engine";
import { createExcelFromPdfTables, type ExcelSheetLayout } from "@/lib/engines/pdf-table-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getTool } from "@/lib/tools";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const tool = getTool("/pdf-to-excel")!;

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

function InfoNote({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) {
  const Icon = tone === "warning" ? AlertCircle : Info;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-2.5 text-xs",
        tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200"
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

function FileCard({
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
      <span className="absolute left-2 top-2 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[11px] font-semibold tabular-nums text-white shadow">
        1
      </span>
      <div className="relative flex h-[236px] items-center justify-center overflow-hidden rounded-xl bg-muted">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- client-rendered local PDF canvas preview
          <img src={thumbnail} alt="" className="h-full w-full object-contain" />
        ) : thumbnail === null ? (
          <div className="flex h-full w-full items-center justify-center">
            <FileText className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
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
        <p className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {pageCount === undefined ? "Reading PDF..." : `${pageCount} page${pageCount === 1 ? "" : "s"}`}
          {" · "}
          {formatFileSize(file.size)}
        </p>
      </div>
    </article>
  );
}

function LayoutCard({
  id,
  label,
  description,
  selected,
  disabled,
  onSelect,
}: {
  id: ExcelSheetLayout;
  label: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: (layout: ExcelSheetLayout) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={() => onSelect(id)}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
          : "border-slate-200 hover:border-amber-300 dark:border-slate-700"
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />}
      </span>
      <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span>
    </button>
  );
}

function ResultView({
  result,
  onDownload,
  onStartOver,
  autoDownloadedRef,
}: {
  result: ExcelResult;
  onDownload: () => void;
  onStartOver: () => void;
  autoDownloadedRef: MutableRefObject<boolean>;
}) {
  return (
    <div>
      <ResultState
        resultFilename={result.filename}
        fileSize={formatFileSize(result.blob.size)}
        onDownload={onDownload}
        onStartOver={onStartOver}
        autoDownloadedRef={autoDownloadedRef}
        downloadLabel="Download Excel"
      />
      <div className="mx-auto mt-2 max-w-xl rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            Created <strong>{result.totalRows}</strong> row{result.totalRows === 1 ? "" : "s"} from{" "}
            <strong>{result.tablePageCount}</strong> PDF page{result.tablePageCount === 1 ? "" : "s"}. Review irregular
            or merged tables in Excel before sharing.
          </p>
        </div>
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
  const { processing, progress, failed, run, cancel } = useProcessingTask();

  const style = getCategoryStyle(tool);
  const ToolIcon = tool.icon;

  useEffect(() => {
    if (!file) return;

    let alive = true;
    setThumbnail(undefined);
    setPageCount(undefined);

    renderFirstPageThumbnailWithInfo(file)
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

    if (next.size > MAX_FILE_SIZE) {
      toast.error("File is too large", {
        description: `${next.name} exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      return;
    }

    window.scrollTo({ top: 0 });
    setFile(next);
    setResult(null);
    autoDownloadRef.current = false;
  };

  const clear = () => {
    setFile(null);
    setThumbnail(undefined);
    setPageCount(undefined);
    setLayout("multiple-sheets");
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
        successMessage: "PDF converted to Excel successfully!",
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

  const downloadResult = useCallback(() => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  }, [result]);

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="pdf-to-excel">
        <ResultView result={result} onDownload={downloadResult} onStartOver={clear} autoDownloadedRef={autoDownloadRef} />
      </PdfToolResultLayout>
    );
  }

  if (!file) {
    return (
      <PdfToolLanding
        title="PDF to Excel"
        description="Extract table data from selectable PDFs into a real Excel spreadsheet. Choose one worksheet or split detected tables by page."
        buttonLabel="Select PDF file"
        dropLabel="or drag and drop a PDF file here"
        limitLabel="100MB max per PDF"
        accept={{ "application/pdf": [".pdf"] }}
        multiple={false}
        icon={ToolIcon}
        iconClass={style.iconClass}
        iconBackgroundClass={style.bgClass}
        accent="amber"
        onFilesSelected={chooseFile}
      />
    );
  }

  const meta = (
    <>
      {file.name} · {pageCount ?? "..."} page{pageCount === 1 ? "" : "s"} · {formatFileSize(file.size)}
    </>
  );
  const canConvert = Boolean(file);

  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50">
      <PdfWorkspaceBar
        title="PDF to Excel"
        meta={meta}
        actions={
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                chooseFile(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <Button variant="ghost" size="sm" onClick={clear} disabled={processing}>
              Clear
            </Button>
          </>
        }
      />

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative min-h-[620px] border-b p-5 lg:border-b-0 lg:border-r lg:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Preview your PDF</p>
                <p className="mt-1 text-xs text-slate-500">Tables are detected from selectable page text.</p>
              </div>
              <PdfAddButton count={1} label="Change PDF" accent="amber" disabled={processing} onClick={() => inputRef.current?.click()} />
            </div>

            <div className="grid grid-cols-1 justify-items-center gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              <FileCard file={file} pageCount={pageCount} thumbnail={thumbnail} onRemove={clear} />
            </div>
          </div>
        </section>

        <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[560px] lg:p-6">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-5 flex shrink-0 items-center gap-3 border-b pb-4">
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", style.bgClass)}>
                <FileSpreadsheet className={cn("h-5 w-5", style.iconClass)} aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Excel options</h2>
                <p className="text-xs text-slate-500">Tables become workbook rows</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <InfoNote>
                Works best with PDFs where table text is selectable and columns are visually aligned.
              </InfoNote>

              <div className="space-y-3" role="radiogroup" aria-label="Excel layout">
                <LayoutCard
                  id="multiple-sheets"
                  label="Multiple sheets"
                  description="Create a separate worksheet for each PDF page with detected table data."
                  selected={layout === "multiple-sheets"}
                  disabled={processing}
                  onSelect={setLayout}
                />
                <LayoutCard
                  id="one-sheet"
                  label="One sheet"
                  description="Place all detected rows into one worksheet with page labels."
                  selected={layout === "one-sheet"}
                  disabled={processing}
                  onSelect={setLayout}
                />
              </div>

              <InfoNote tone="warning">
                Scanned or image-only PDFs need OCR first. This browser-local converter does not upload files or run server OCR.
              </InfoNote>

              {failed && <InfoNote tone="warning">Conversion failed. Try a PDF with selectable table text.</InfoNote>}
            </div>

            {processing ? (
              <div className="mt-5 shrink-0">
                <ProcessingState progress={progress} onCancel={cancel} label={processingLabel} />
              </div>
            ) : (
              <button
                type="button"
                onClick={convertToExcel}
                disabled={!canConvert}
                className="mt-5 flex min-h-16 w-full shrink-0 items-center justify-center rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-500 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0"
              >
                Convert to Excel
              </button>
            )}
            <p className="mt-3 text-center text-xs text-slate-500">Browser-local conversion · nothing is uploaded</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
