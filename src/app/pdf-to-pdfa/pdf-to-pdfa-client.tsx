"use client";

import { UiText } from "@/components/i18n/UiText";

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertCircle, Archive, FileCheck2, FileText, Info, ShieldCheck, RotateCw, X } from "lucide-react";
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
import { convertPdfToPdfa, type PdfaConformance, type PdfaConversionResult } from "@/lib/engines/pdfa-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getTool } from "@/lib/tools";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const tool = getTool("/pdf-to-pdfa")!;

interface PdfToPdfaClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

interface LevelOption {
  id: PdfaConformance;
  label: string;
  summary: string;
  details: string;
}

const LEVEL_OPTIONS: LevelOption[] = [
  { id: "PDF/A-2b", label: "PDF/A-2b", summary: "Modern visual archive", details: "Preserves page appearance in a self-contained PDF 1.7 archive with an embedded sRGB color profile." },
  { id: "PDF/A-1b", label: "PDF/A-1b", summary: "Older archive systems", details: "Creates an opaque PDF 1.4 visual archive for systems that require PDF/A-1b." },
  { id: "PDF/A-3b", label: "PDF/A-3b", summary: "PDF/A-3 visual archive", details: "Creates a visual PDF/A-3 archive. Source attachments are not included." },
];

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
  rotation = 0,
}: {
  file: File;
  pageCount?: number;
  thumbnail?: string | null;
  onRemove: () => void;
  rotation?: number;
}) {
  return (
    <article className="group relative flex min-h-[302px] w-[234px] flex-col rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] transition-shadow hover:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-slate-900">
      <div className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {formatFileSize(file.size)}
        {pageCount ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}
      </div>
      <span className="absolute left-2 top-2 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[11px] font-semibold tabular-nums text-white shadow">
        1
      </span>
      <div className="relative flex h-[236px] items-center justify-center overflow-hidden rounded-xl bg-muted">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- client-rendered local PDF canvas preview
          <img src={thumbnail} alt="" className="h-full w-full object-contain" style={{ transform: `rotate(${rotation}deg) scale(${rotation % 180 ? 0.85 : 1})` }} />
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
          {pageCount === undefined ? (thumbnail === null ? "Preview unavailable" : "Reading PDF...") : `${pageCount} page${pageCount === 1 ? "" : "s"}`}
          {" · "}
          {formatFileSize(file.size)}
        </p>
      </div>
    </article>
  );
}

function ResultView({
  result,
  onDownload,
  onStartOver,
  autoDownloadedRef,
}: {
  result: PdfaConversionResult;
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
        downloadLabel="Download PDF/A"
      />
      <div className="mx-auto mt-2 max-w-xl rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            Created a visual <strong>{result.conformance}</strong> copy from{" "}
            <strong>{result.pageCount}</strong> page{result.pageCount === 1 ? "" : "s"}. Pages are fixed images; text selection, links and editable forms are not retained. Run
            the file through the receiving archive&apos;s PDF/A validator before submission.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PdfToPdfaClient({ faqs: _faqs, related: _related }: PdfToPdfaClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null | undefined>(undefined);
  const [pageCount, setPageCount] = useState<number | undefined>(undefined);
  const [conformance, setConformance] = useState<PdfaConformance>("PDF/A-2b");
  const [dpi, setDpi] = useState<150 | 300>(150);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<PdfaConversionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingLabel, setProcessingLabel] = useState("Preparing archive copy...");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask();

  const style = getCategoryStyle(tool);
  const ToolIcon = tool.icon;
  const selectedLevel = LEVEL_OPTIONS.find((option) => option.id === conformance) ?? LEVEL_OPTIONS[0];

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
    setRotation(0);
    setResult(null);
    setErrorMessage(null);
    autoDownloadRef.current = false;
  };

  const clear = () => {
    setFile(null);
    setThumbnail(undefined);
    setPageCount(undefined);
    setConformance("PDF/A-2b");
    setDpi(150);
    setRotation(0);
    setResult(null);
    setErrorMessage(null);
    autoDownloadRef.current = false;
  };

  const convertToPdfa = () => {
    if (!file) return;

    run(
      async (setProgress, isCancelled) => {
        setResult(null);
    setErrorMessage(null);
        autoDownloadRef.current = false;
        setProcessingLabel("Reading PDF...");
        setProgress(8);

        const nextResult = await convertPdfToPdfa(
          file,
          { conformance, dpi, rotation, isCancelled },
          (done, total) => {
            setProcessingLabel(`Archiving page ${done} of ${total}...`);
            setProgress(12 + (done / total) * 76);
          }
        );

        if (isCancelled()) return;

        setProcessingLabel("Finalizing PDF/A metadata...");
        setProgress(96);
        setResult(nextResult);
        setProgress(100);
      },
      {
        successMessage: "PDF/A copy created successfully!",
        toolName: "pdf-to-pdfa",
        errorTitle: "Failed to convert to PDF/A",
        onError: (error) => {
          console.error("Error converting PDF to PDF/A:", error);
          const message = error instanceof Error ? error.message : "";
          const description = message.includes("is encrypted")
            ? "This PDF is password-protected. Please remove the password and try again."
            : message || "Please try again with a valid PDF file.";
          setErrorMessage(description);
          return description;
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
      <PdfToolResultLayout toolSlug="pdf-to-pdfa">
        <ResultView result={result} onDownload={downloadResult} onStartOver={clear} autoDownloadedRef={autoDownloadRef} />
      </PdfToolResultLayout>
    );
  }

  if (!file) {
    return (
      <PdfToolLanding
        title="PDF to PDF/A"
        description="Create a visual PDF/A archive with an embedded color profile. Free, private, and processed in your browser."
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

  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50">
      <PdfWorkspaceBar
        title="PDF to PDF/A"
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
              <UiText text="Clear" />
            </Button>
          </>
        }
      />

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="relative min-h-[360px] lg:min-h-[620px] border-b p-5 lg:border-b-0 lg:border-r lg:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Preview your PDF</p>
                <p className="mt-1 text-xs text-slate-500">Build a long-term archive copy from this file.</p>
              </div>
              <PdfAddButton count={1} label="Change PDF" accent="amber" disabled={processing} onClick={() => inputRef.current?.click()} />
            </div>

            <div className="grid grid-cols-1 justify-items-center gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              <div className="flex flex-col items-center gap-3">
                <FileCard file={file} pageCount={pageCount} thumbnail={thumbnail} rotation={rotation} onRemove={() => { if (!processing) clear(); }} />
                <Button variant="outline" size="sm" disabled={processing} onClick={() => setRotation(value => (value + 90) % 360)}><RotateCw className="mr-2 h-4 w-4" />Rotate all pages</Button>
              </div>
            </div>
          </div>
        </section>

        <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[620px] lg:p-6">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-5 flex shrink-0 items-center gap-3 border-b pb-4">
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", style.bgClass)}>
                <FileCheck2 className={cn("h-5 w-5", style.iconClass)} aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Archive options</h2>
                <p className="text-xs text-slate-500">Free browser-local PDF/A copy</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <InfoNote>
                All pages are saved as fixed images. Appearance is preserved, but selectable text, links, form fields, digital signatures and attachments are not retained.
              </InfoNote>

              <div className="space-y-2">
                <label htmlFor="pdfa-level" className="text-sm font-semibold">
                  PDF/A conformance level
                </label>
                <select
                  id="pdfa-level"
                  value={conformance}
                  disabled={processing}
                  onChange={(event) => setConformance(event.target.value as PdfaConformance)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                >
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label} - {option.summary}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <Archive className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold">{selectedLevel.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{selectedLevel.details}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="pdfa-dpi" className="text-sm font-semibold">Image resolution</label>
                <select id="pdfa-dpi" value={dpi} disabled={processing} onChange={event => setDpi(Number(event.target.value) as 150 | 300)} className="h-12 w-full rounded-xl border bg-background px-3 text-sm">
                  <option value={150}>150 DPI — smaller file</option><option value={300}>300 DPI — sharper text</option>
                </select>
                <p className="text-xs text-muted-foreground">Original page dimensions are retained. Images use lossless compression.</p>
              </div>
              <InfoNote>Visual profiles 1b, 2b and 3b are available. Tagged accessibility and searchable Unicode archive conversion are not supported yet.</InfoNote>
              {errorMessage && <div role="alert"><InfoNote tone="warning">{errorMessage}</InfoNote></div>}
            </div>

            {processing ? (
              <div className="mt-5 shrink-0">
                <ProcessingState progress={progress} onCancel={cancel} label={processingLabel} />
              </div>
            ) : (
              <button
                type="button"
                onClick={convertToPdfa}
                className="mt-5 flex min-h-16 w-full shrink-0 items-center justify-center rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-500 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 motion-reduce:hover:translate-y-0"
              >
                Convert to PDF/A
              </button>
            )}
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              Browser-local conversion · nothing is uploaded
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
