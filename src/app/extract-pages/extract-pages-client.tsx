"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, FileOutput, Info, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageThumbnailGrid } from "@/components/pdf/PageThumbnailGrid";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { PdfAddButton, PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ResultState } from "@/components/tool/ResultState";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
import { getCategoryStyle } from "@/lib/category-colors";
import { downloadBlob } from "@/lib/download-file";
import { extractAllPagesGroups, extractPageGroups, safeBaseName, type SplitOutput } from "@/lib/engines/pdf-split-engine";
import { expandPageRanges, parseAndValidateRanges, rangesToString, selectedPagesToRanges } from "@/lib/pdf-page-ranges";
import { cn, formatFileSize } from "@/lib/utils";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getTool } from "@/lib/tools";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const tool = getTool("/extract-pages")!;

type ExtractMode = "all" | "select";

interface ExtractPagesClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

interface ExtractResult {
  blob: Blob;
  filename: string;
  outputs: SplitOutput[];
  mode: ExtractMode;
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
  result: ExtractResult;
  onDownload: () => void;
  onStartOver: () => void;
  autoDownloadedRef: React.MutableRefObject<boolean>;
}) {
  const isZip = result.filename.endsWith(".zip");
  return (
    <div>
      <ResultState
        resultFilename={result.filename}
        fileSize={formatFileSize(result.blob.size)}
        onDownload={onDownload}
        onStartOver={onStartOver}
        autoDownloadedRef={autoDownloadedRef}
        downloadLabel={isZip ? "Download ZIP" : "Download PDF"}
      />
      <div className="mx-auto mt-2 max-w-xl rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            Created <strong>{result.outputs.length}</strong> PDF{result.outputs.length === 1 ? "" : "s"} from the
            selected pages. Page quality is preserved from the original PDF.
          </p>
        </div>
      </div>
    </div>
  );
}

function buildPageGroupsFromSelection(selected: Set<number>) {
  return [...selected].sort((a, b) => a - b).map((pageIndex) => [pageIndex + 1]);
}

export function ExtractPagesClient({ faqs: _faqs, related: _related }: ExtractPagesClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<ExtractMode>("all");
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [rangeText, setRangeText] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [mergeSelected, setMergeSelected] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoDownloadRef = useRef(false);
  const lastClickedRef = useRef<number | null>(null);
  const { processing, progress, failed, run, cancel } = useProcessingTask();

  const style = getCategoryStyle(tool);
  const ToolIcon = tool.icon;
  const allPagesSelected = useMemo(() => new Set(Array.from({ length: pageCount }, (_, index) => index)), [pageCount]);
  const displaySelection = mode === "all" ? allPagesSelected : selectedPages;
  const selectedCount = mode === "all" ? pageCount : selectedPages.size;
  const outputCount = mode === "all" ? pageCount : mergeSelected && selectedCount > 0 ? 1 : selectedCount;
  const canExtract = Boolean(file && pageCount > 0 && !loadError && !rangeError && selectedCount > 0);

  const selectionSummary = useMemo(() => {
    if (!pageCount) return "Waiting for page previews...";
    if (mode === "all") return `${pageCount} separate PDF${pageCount === 1 ? "" : "s"} will be created.`;
    if (selectedCount === 0) return "Select at least one page to extract.";
    if (mergeSelected) return `${selectedCount} page${selectedCount === 1 ? "" : "s"} will be merged into one PDF.`;
    return `${selectedCount} separate PDF${selectedCount === 1 ? "" : "s"} will be created.`;
  }, [mergeSelected, mode, pageCount, selectedCount]);

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
    setMode("all");
    setSelectedPages(new Set());
    setRangeText("");
    setRangeError("");
    setMergeSelected(false);
    setLoadError(false);
    setResult(null);
    autoDownloadRef.current = false;
    lastClickedRef.current = null;
  };

  const clear = () => {
    setFile(null);
    setPageCount(0);
    setMode("all");
    setSelectedPages(new Set());
    setRangeText("");
    setRangeError("");
    setMergeSelected(false);
    setLoadError(false);
    setResult(null);
    autoDownloadRef.current = false;
    lastClickedRef.current = null;
  };

  const syncSelection = (next: Set<number>) => {
    setSelectedPages(next);
    setRangeText(rangesToString(selectedPagesToRanges(next)));
    setRangeError("");
  };

  const updateRangeText = (value: string, totalPages = pageCount) => {
    setMode("select");
    setRangeText(value);
    if (!value.trim()) {
      setSelectedPages(new Set());
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
    setSelectedPages(new Set(expandPageRanges(parsed.ranges, totalPages)));
  };

  const togglePage = (pageIndex: number, shiftKey = false) => {
    setMode("select");
    setSelectedPages((prev) => {
      const base = mode === "all" ? new Set(allPagesSelected) : new Set(prev);
      if (shiftKey && lastClickedRef.current !== null) {
        const start = Math.min(lastClickedRef.current, pageIndex);
        const end = Math.max(lastClickedRef.current, pageIndex);
        const shouldSelect = !base.has(pageIndex);
        for (let index = start; index <= end; index++) {
          if (shouldSelect) base.add(index);
          else base.delete(index);
        }
      } else if (base.has(pageIndex)) {
        base.delete(pageIndex);
      } else {
        base.add(pageIndex);
      }
      lastClickedRef.current = pageIndex;
      setRangeText(rangesToString(selectedPagesToRanges(base)));
      setRangeError("");
      return base;
    });
  };

  const extractPages = () => {
    if (!file || !canExtract) return;

    run(
      async (setProgress) => {
        setResult(null);
        autoDownloadRef.current = false;
        setProgress(6);

        const buffer = await file.arrayBuffer();
        const groups = mode === "all" ? extractAllPagesGroups(pageCount) : buildPageGroupsFromSelection(selectedPages);
        const merge = mode === "select" && mergeSelected;
        const outputs = await extractPageGroups(buffer, file.name, groups, merge, (done, total) => {
          setProgress(8 + (done / total) * 78);
        });

        if (outputs.length === 0) {
          throw new Error("Select at least one page to extract.");
        }

        if (outputs.length === 1) {
          setResult({
            blob: new Blob([outputs[0].bytes as unknown as BlobPart], { type: "application/pdf" }),
            filename: outputs[0].name,
            outputs,
            mode,
          });
        } else {
          const { zipSync } = await import("fflate");
          const entries: Record<string, Uint8Array> = {};
          outputs.forEach((output, index) => {
            let name = output.name;
            while (entries[name]) name = `${safeBaseName(output.name)}-${index + 1}.pdf`;
            entries[name] = output.bytes;
          });
          const archive = zipSync(entries);
          setResult({
            blob: new Blob([archive as unknown as BlobPart], { type: "application/zip" }),
            filename: `${safeBaseName(file.name)}_extracted_pages.zip`,
            outputs,
            mode,
          });
        }
        setProgress(100);
      },
      {
        successMessage: "Pages extracted successfully!",
        toolName: "extract-pages",
        errorTitle: "Failed to extract pages",
        onError: (error) => {
          console.error("Error extracting PDF pages:", error);
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
      <PdfToolResultLayout toolSlug="extract-pages">
        <ResultView result={result} onDownload={downloadResult} onStartOver={clear} autoDownloadedRef={autoDownloadRef} />
      </PdfToolResultLayout>
    );
  }

  if (!file) {
    return (
      <PdfToolLanding
        title="Extract Pages"
        description="Pull pages out of a PDF as separate files, or select the pages you want and merge them into one clean PDF."
        buttonLabel="Select PDF file"
        dropLabel="or drag and drop a PDF file here"
        limitLabel="100MB max per PDF"
        accept={{ "application/pdf": [".pdf"] }}
        multiple={false}
        icon={ToolIcon}
        iconClass={style.iconClass}
        iconBackgroundClass={style.bgClass}
        accent="orange"
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
        title="Extract Pages"
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
              <p className="mt-1 text-xs text-slate-500">Choose the pages you want to extract.</p>
            </div>
            <PdfAddButton count={pageCount || 1} label="Change PDF" accent="orange" disabled={processing} onClick={() => inputRef.current?.click()} />
          </div>

          <PageThumbnailGrid
            file={file}
            selected={displaySelection}
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
                <FileOutput className={cn("h-5 w-5", style.iconClass)} aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Extract mode</h2>
                <p className="text-xs text-slate-500">Preview updates as you choose</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Extract mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "all"}
                  onClick={() => {
                    setMode("all");
                    setRangeText("");
                    setRangeError("");
                  }}
                  className={cn(
                    "flex min-h-14 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                    mode === "all"
                      ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-200"
                      : "border-slate-200 text-slate-500 hover:border-orange-300 dark:border-slate-700"
                  )}
                >
                  Extract all pages
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "select"}
                  onClick={() => setMode("select")}
                  className={cn(
                    "flex min-h-14 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                    mode === "select"
                      ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-200"
                      : "border-slate-200 text-slate-500 hover:border-orange-300 dark:border-slate-700"
                  )}
                >
                  Select pages
                </button>
              </div>

              <InfoNote>
                {mode === "all"
                  ? `Every page will become its own PDF. ${pageCount || "..."} PDF${pageCount === 1 ? "" : "s"} will be created.`
                  : "Click thumbnails or enter ranges like 1,5-8 to choose pages."}
              </InfoNote>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <MousePointer2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold">{selectionSummary}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Output: {outputCount || 0} PDF{outputCount === 1 ? "" : "s"}
                      {outputCount > 1 ? " in one ZIP download." : "."}
                    </p>
                  </div>
                </div>
              </div>

              {mode === "select" && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="pages-to-extract" className="text-sm font-semibold">
                      Pages to extract
                    </label>
                    <input
                      id="pages-to-extract"
                      value={rangeText}
                      disabled={processing || !pageCount}
                      onChange={(event) => updateRangeText(event.target.value)}
                      placeholder="example: 1,5-8"
                      className={cn(
                        "h-12 w-full rounded-xl border bg-white px-3 text-sm shadow-sm outline-none transition focus:ring-2 disabled:opacity-60 dark:bg-slate-950",
                        rangeError
                          ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                          : "border-slate-200 focus:border-orange-500 focus:ring-orange-500/20 dark:border-slate-700"
                      )}
                    />
                    {rangeError && <p className="text-xs text-destructive">{rangeError}</p>}
                  </div>

                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={mergeSelected}
                      onChange={(event) => setMergeSelected(event.target.checked)}
                      className="h-4 w-4"
                    />
                    Merge selected pages into one PDF file
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncSelection(new Set(Array.from({ length: pageCount }, (_, index) => index)))}
                      disabled={processing || !pageCount}
                    >
                      Select all
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => syncSelection(new Set())} disabled={processing || selectedCount === 0}>
                      Clear selection
                    </Button>
                  </div>
                </>
              )}

              {failed && <InfoNote tone="warning">Could not extract these pages. Try another PDF or a smaller selection.</InfoNote>}
            </div>

            {processing ? (
              <div className="mt-5 shrink-0">
                <ProcessingState progress={progress} onCancel={cancel} label="Extracting selected pages..." />
              </div>
            ) : (
              <button
                type="button"
                onClick={extractPages}
                disabled={!canExtract}
                className="mt-5 flex min-h-16 w-full shrink-0 items-center justify-center rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0"
              >
                {failed ? "Try Again" : "Extract Pages"}
              </button>
            )}
            <p className="mt-3 text-center text-xs text-slate-500">Browser-local extraction · nothing is uploaded</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
