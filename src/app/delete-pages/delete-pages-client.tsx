"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, FileX, Info, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { PdfAddButton, PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ResultState } from "@/components/tool/ResultState";
import { PageThumbnailGrid } from "@/components/pdf/PageThumbnailGrid";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
import { getCategoryStyle } from "@/lib/category-colors";
import { downloadBlob } from "@/lib/download-file";
import { expandPageRanges, parseAndValidateRanges, rangesToString, selectedPagesToRanges } from "@/lib/pdf-page-ranges";
import { cn, formatFileSize } from "@/lib/utils";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getTool } from "@/lib/tools";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const tool = getTool("/delete-pages")!;

interface DeletePagesClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

interface RemoveResult {
  blob: Blob;
  filename: string;
  removedCount: number;
  keptCount: number;
}

function safeBaseName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

function InfoNote({ tone = "info", children }: { tone?: "info" | "warning"; children: React.ReactNode }) {
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

function ResultView({
  result,
  onDownload,
  onStartOver,
  autoDownloadedRef,
}: {
  result: RemoveResult;
  onDownload: () => void;
  onStartOver: () => void;
  autoDownloadedRef: React.MutableRefObject<boolean>;
}) {
  return (
    <div>
      <ResultState
        resultFilename={result.filename}
        fileSize={formatFileSize(result.blob.size)}
        onDownload={onDownload}
        onStartOver={onStartOver}
        autoDownloadedRef={autoDownloadedRef}
        downloadLabel="Download PDF"
      />
      <div className="mx-auto mt-2 max-w-xl rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            Removed <strong>{result.removedCount}</strong> page{result.removedCount === 1 ? "" : "s"} and kept{" "}
            <strong>{result.keptCount}</strong> page{result.keptCount === 1 ? "" : "s"}. Remaining pages keep their
            original quality.
          </p>
        </div>
      </div>
    </div>
  );
}

export function DeletePagesClient({ faqs: _faqs, related: _related }: DeletePagesClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<number>>(new Set());
  const [rangeText, setRangeText] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [result, setResult] = useState<RemoveResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, failed, run, cancel } = useProcessingTask();

  const style = getCategoryStyle(tool);
  const ToolIcon = tool.icon;
  const selectedCount = selectedForRemoval.size;
  const keptCount = Math.max(pageCount - selectedCount, 0);
  const wouldRemoveEverything = pageCount > 0 && selectedCount === pageCount;
  const canRemove = selectedCount > 0 && !wouldRemoveEverything && !rangeError && !loadError;

  const selectionSummary = useMemo(() => {
    if (!pageCount) return "Waiting for page previews...";
    if (selectedCount === 0) return "No pages selected";
    return `${selectedCount} of ${pageCount} page${pageCount === 1 ? "" : "s"} will be removed`;
  }, [pageCount, selectedCount]);

  const syncSelection = (next: Set<number>) => {
    setSelectedForRemoval(next);
    setRangeText(rangesToString(selectedPagesToRanges(next)));
    setRangeError("");
  };

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
    setPageCount(0);
    setSelectedForRemoval(new Set());
    setRangeText("");
    setRangeError("");
    setLoadError(false);
    setResult(null);
    autoDownloadRef.current = false;
  };

  const clear = () => {
    setFile(null);
    setPageCount(0);
    setSelectedForRemoval(new Set());
    setRangeText("");
    setRangeError("");
    setLoadError(false);
    setResult(null);
    autoDownloadRef.current = false;
  };

  const lastClickedRef = useRef<number | null>(null);

  const togglePage = (pageIndex: number, shiftKey = false) => {
    setSelectedForRemoval((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClickedRef.current !== null) {
        const start = Math.min(lastClickedRef.current, pageIndex);
        const end = Math.max(lastClickedRef.current, pageIndex);
        const shouldSelect = !next.has(pageIndex);
        for (let index = start; index <= end; index++) {
          if (shouldSelect) next.add(index);
          else next.delete(index);
        }
      } else if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        next.add(pageIndex);
      }
      lastClickedRef.current = pageIndex;
      setRangeText(rangesToString(selectedPagesToRanges(next)));
      setRangeError("");
      return next;
    });
  };

  const updateRangeText = (value: string, totalPages = pageCount) => {
    setRangeText(value);
    if (!value.trim()) {
      setSelectedForRemoval(new Set());
      setRangeError("");
      return;
    }
    if (!totalPages) return;
    const parsed = parseAndValidateRanges(value, totalPages);
    if (!parsed.ranges) {
      setRangeError(parsed.error ?? "Enter a valid page range.");
      return;
    }
    setRangeError("");
    setSelectedForRemoval(new Set(expandPageRanges(parsed.ranges, totalPages)));
  };

  const removePages = () => {
    if (!file || !canRemove) return;

    run(
      async (setProgress) => {
        setResult(null);
        autoDownloadRef.current = false;
        setProgress(8);

        const { PDFDocument } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const totalPages = pdf.getPageCount();
        const pagesToKeep = Array.from({ length: totalPages }, (_, index) => index).filter((index) => !selectedForRemoval.has(index));

        if (pagesToKeep.length === 0) {
          throw new Error("A PDF needs at least one page. Keep one page out of removal.");
        }

        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdf, pagesToKeep);
        copiedPages.forEach((page, index) => {
          newPdf.addPage(page);
          setProgress(12 + ((index + 1) / copiedPages.length) * 76);
        });

        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setProgress(100);
        setResult({
          blob,
          filename: `${safeBaseName(file.name)}_removed.pdf`,
          removedCount: selectedForRemoval.size,
          keptCount: pagesToKeep.length,
        });
      },
      {
        successMessage: "PDF pages removed successfully!",
        toolName: "delete-pages",
        errorTitle: "Failed to remove pages",
        onError: (error) => {
          console.error("Error removing PDF pages:", error);
          const message = error instanceof Error ? error.message : "";
          return message.includes("is encrypted")
            ? "This PDF is password-protected. Please remove the password and try again."
            : message || "Please try again with a valid PDF file.";
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
      <PdfToolResultLayout toolSlug="delete-pages">
        <ResultView result={result} onDownload={downloadResult} onStartOver={clear} autoDownloadedRef={autoDownloadRef} />
      </PdfToolResultLayout>
    );
  }

  if (!file) {
    return (
      <PdfToolLanding
        title="Remove PDF Pages"
        description="Select the pages you do not need and download a clean PDF with the rest preserved."
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
      {file.name} · {pageCount || "..."} page{pageCount === 1 ? "" : "s"} · {formatFileSize(file.size)}
    </>
  );

  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50">
      <PdfWorkspaceBar
        title="Remove PDF Pages"
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

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="relative min-h-[680px] border-b p-5 lg:border-b-0 lg:border-r lg:p-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Preview your pages</p>
              <p className="mt-1 text-xs text-slate-500">Click pages to mark them for removal.</p>
            </div>
            <PdfAddButton count={pageCount || 1} label="Change PDF" accent="amber" disabled={processing} onClick={() => inputRef.current?.click()} />
          </div>

          <PageThumbnailGrid
            file={file}
            selected={selectedForRemoval}
            onToggle={togglePage}
            onPagesLoaded={(count) => {
              setPageCount(count);
              if (rangeText.trim()) updateRangeText(rangeText, count);
            }}
            onError={(error) => {
              console.error("Error rendering PDF pages:", error);
              setLoadError(true);
            }}
          />
        </section>

        <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[620px] lg:p-6">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-5 flex shrink-0 items-center gap-3 border-b pb-4">
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", style.bgClass)}>
                <FileX className={cn("h-5 w-5", style.iconClass)} aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Remove pages</h2>
                <p className="text-xs text-slate-500">{pageCount || "..."} total pages</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <InfoNote>
                Click thumbnails to remove pages. Use the box below for ranges like <strong>1,5-9</strong>.
              </InfoNote>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <MousePointer2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold">{selectionSummary}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {keptCount > 0 ? `${keptCount} page${keptCount === 1 ? "" : "s"} will stay in the new PDF.` : "Select fewer pages to keep the PDF valid."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="pages-to-remove" className="text-sm font-semibold">
                  Pages to remove
                </label>
                <input
                  id="pages-to-remove"
                  value={rangeText}
                  disabled={processing || !pageCount}
                  onChange={(event) => updateRangeText(event.target.value)}
                  placeholder="example: 1,5-8"
                  className={cn(
                    "h-12 w-full rounded-xl border bg-white px-3 text-sm shadow-sm outline-none transition focus:ring-2 disabled:opacity-60 dark:bg-slate-950",
                    rangeError
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : "border-slate-200 focus:border-amber-500 focus:ring-amber-500/20 dark:border-slate-700"
                  )}
                />
                {rangeError && <p className="text-xs text-destructive">{rangeError}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => syncSelection(new Set())} disabled={processing || selectedCount === 0}>
                  Clear selection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncSelection(new Set(Array.from({ length: Math.max(pageCount - 1, 0) }, (_, index) => index)))}
                  disabled={processing || pageCount < 2}
                >
                  Remove all but last
                </Button>
              </div>

              {wouldRemoveEverything && (
                <InfoNote tone="warning">A PDF needs at least one page. Deselect one page before removing.</InfoNote>
              )}

              {failed && <InfoNote tone="warning">Could not remove these pages. Try another PDF or a smaller range.</InfoNote>}
            </div>

            {processing ? (
              <div className="mt-5 shrink-0">
                <ProcessingState progress={progress} onCancel={cancel} label="Removing selected pages..." />
              </div>
            ) : (
              <button
                type="button"
                onClick={removePages}
                disabled={!canRemove}
                className="mt-5 flex min-h-16 w-full shrink-0 items-center justify-center rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-500 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0"
              >
                {selectedCount > 0 ? `Remove ${selectedCount} page${selectedCount === 1 ? "" : "s"}` : "Remove pages"}
              </button>
            )}
            <p className="mt-3 text-center text-xs text-slate-500">Browser-local removal · nothing is uploaded</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
