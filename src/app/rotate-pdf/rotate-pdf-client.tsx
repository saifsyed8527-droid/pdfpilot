"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { PageThumbnailGrid, type PageThumbnail } from "@/components/pdf/PageThumbnailGrid";
import { getCategoryStyle } from "@/lib/category-colors";
import { getTool } from "@/lib/tools";
import { cn, formatFileSize } from "@/lib/utils";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

interface RotatePdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

const tool = getTool("/rotate-pdf")!;
const style = getCategoryStyle(tool);

const LANDING_COPY = {
  title: "Rotate PDF",
  description: "Rotate individual pages, or every page at once — useful when a scan came out sideways.",
  buttonLabel: "Select PDF file",
  dropLabel: "or drag and drop a PDF file here",
  limitLabel: "100MB max per PDF",
};

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;

export function RotatePdfClient({}: RotatePdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ blob: Blob; previewDataUrl: string | null } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const autoDownloadRef = useRef(false);
  const { processing, progress, failed, run, cancel } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setPageCount(0);
      setThumbnails([]);
      setPageRotations({});
      setResult(null);
      setLoadError(false);
      autoDownloadRef.current = false;
    }
  };

  const rotatePage = (pageIndex: number, delta: number) => {
    setPageRotations((prev) => ({
      ...prev,
      [pageIndex]: normalizeAngle((prev[pageIndex] ?? 0) + delta),
    }));
  };

  const rotateAll = (delta: number) => {
    setPageRotations((prev) => {
      const next: Record<number, number> = { ...prev };
      for (let i = 0; i < pageCount; i++) {
        next[i] = normalizeAngle((prev[i] ?? 0) + delta);
      }
      return next;
    });
  };

  const resetRotations = () => setPageRotations({});

  const changedPageCount = useMemo(
    () => Object.values(pageRotations).filter((angle) => angle !== 0).length,
    [pageRotations]
  );

  const applyRotations = () => {
    if (!file) return;

    run(
      async (setProgress, isCancelled) => {
        setResult(null);
        autoDownloadRef.current = false;
        const { PDFDocument, degrees } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = pdf.getPages();

        for (let index = 0; index < pages.length; index++) {
          if (isCancelled()) return;
          const page = pages[index];
          const delta = pageRotations[index] ?? 0;
          if (delta !== 0) {
            const currentAngle = page.getRotation().angle;
            page.setRotation(degrees(normalizeAngle(currentAngle + delta)));
          }
          setProgress(((index + 1) / pages.length) * 100);
        }

        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

        // Reuses the already-rendered first-page thumbnail for the
        // confirmation preview, with its final rotation applied via CSS —
        // no second pdfjs render needed for a one-page confirmation shot.
        const previewDataUrl = thumbnails[0]?.dataUrl ?? null;
        setResult({ blob, previewDataUrl });
      },
      {
        successMessage: "PDF rotated successfully!",
        toolName: "rotate-pdf",
        errorTitle: "Failed to rotate PDF",
        onError: (error) => {
          console.error("Error rotating PDF:", error);
          return "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (result) downloadBlob(result.blob, "rotated.pdf");
  };

  const clear = () => {
    setFile(null);
    setPageCount(0);
    setThumbnails([]);
    setPageRotations({});
    setResult(null);
    setLoadError(false);
    autoDownloadRef.current = false;
  };

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="rotate-pdf">
        <ResultState
          resultFilename="rotated.pdf"
          fileSize={formatFileSize(result.blob.size)}
          onDownload={downloadResult}
          onStartOver={clear}
          autoDownloadedRef={autoDownloadRef}
        />
        {result.previewDataUrl && (
          <div className="mx-auto mt-2 w-28 overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
            {/* eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot */}
            <img
              src={result.previewDataUrl}
              alt="Preview of the first page after rotation"
              className="block h-auto w-full"
              style={pageRotations[0] ? { transform: `rotate(${pageRotations[0]}deg)` } : undefined}
            />
          </div>
        )}
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
        icon={tool.icon}
        iconClass={style.iconClass}
        iconBackgroundClass={style.bgClass}
        accent="orange"
        onFilesSelected={handleFilesSelected}
      />
    );
  }

  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50">
      <PdfWorkspaceBar
        title="Rotate PDF"
        meta={<>{file.name} · {formatFileSize(file.size)}{pageCount > 0 ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}</>}
        actions={
          <Button variant="ghost" size="sm" onClick={clear} disabled={processing}>
            Change file
          </Button>
        }
      />
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-h-[620px] border-b p-5 lg:border-b-0 lg:border-r lg:p-8">
          <div className="mb-8">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Preview your pages</p>
            <p className="mt-1 text-xs text-slate-500">Rotate individual pages, or rotate every page at once.</p>
          </div>

          <PageThumbnailGrid
            file={file}
            pageRotations={pageRotations}
            renderPageAction={(pageIndex) => (
              <>
                <button
                  type="button"
                  aria-label={`Rotate page ${pageIndex + 1} counterclockwise`}
                  onClick={() => rotatePage(pageIndex, -90)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow transition hover:border-orange-400 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Rotate page ${pageIndex + 1} clockwise`}
                  onClick={() => rotatePage(pageIndex, 90)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow transition hover:border-orange-400 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-300"
                >
                  <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </>
            )}
            onPagesLoaded={setPageCount}
            onThumbnailsReady={setThumbnails}
            onError={(error) => {
              console.error("Error rendering PDF pages:", error);
              setLoadError(true);
            }}
          />

          {loadError && (
            <Button variant="outline" size="sm" className="mt-4" onClick={clear}>
              Choose a Different File
            </Button>
          )}
        </section>

        <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[560px] lg:p-6">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-5 flex shrink-0 items-center gap-3 border-b pb-4">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.bgClass)}>
                <RotateCw className={cn("h-5 w-5", style.iconClass)} aria-hidden />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Rotate options</h2>
                <p className="text-xs text-slate-500">Preview updates as you choose</p>
              </div>
            </div>

            {!loadError && (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  <div>
                    <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">Rotate all pages</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => rotateAll(-90)}
                        disabled={processing}
                        className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-600 transition-colors hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-orange-950/20"
                      >
                        <RotateCcw className="h-5 w-5" aria-hidden />
                        Rotate Left
                      </button>
                      <button
                        type="button"
                        onClick={() => rotateAll(90)}
                        disabled={processing}
                        className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-600 transition-colors hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-orange-950/20"
                      >
                        <RotateCw className="h-5 w-5" aria-hidden />
                        Rotate Right
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <p className="text-xs leading-5 text-slate-500" aria-live="polite">
                      {changedPageCount === 0
                        ? "No pages rotated yet"
                        : `${changedPageCount} of ${pageCount} page${pageCount === 1 ? "" : "s"} will be rotated`}
                    </p>
                    <button
                      type="button"
                      onClick={resetRotations}
                      disabled={processing || changedPageCount === 0}
                      className="shrink-0 text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline dark:text-slate-400 dark:hover:text-white"
                    >
                      Reset All
                    </button>
                  </div>

                  {failed && !processing && (
                    <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <p>Rotate failed. Please try again with a valid PDF file.</p>
                    </div>
                  )}
                </div>

                {processing ? (
                  <div className="mt-5 shrink-0">
                    <ProcessingState progress={progress} onCancel={cancel} label="Rotating PDF…" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={applyRotations}
                    disabled={changedPageCount === 0}
                    className="mt-5 flex min-h-16 w-full shrink-0 items-center justify-center rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0"
                  >
                    {failed ? "Try Again" : "Rotate PDF"}
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
