"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  X,
  Info,
  AlertCircle,
  CheckCircle2,
  Download,
  RefreshCw,
  Rows3,
  Grid2x2,
  Scale,
} from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize, cn } from "@/lib/utils";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  renderPdfPages,
  classifyPdfRenderError,
  PDF_RENDER_ERROR_MESSAGE,
  type PdfRenderErrorKind,
} from "@/lib/engines/pdf-render-engine";
import {
  safeBaseName,
  splitByCustomRanges,
  splitByFixedSize,
  computeFixedGroupCount,
  computeFixedPageGroups,
  parsePageExpression,
  extractPageGroups,
  extractAllPagesGroups,
  splitBySize,
  estimateSizeGroupCount,
  type SplitOutput,
} from "@/lib/engines/pdf-split-engine";
import { compressPdfForSizeSplit } from "@/lib/engines/pdf-compress-engine";
import {
  SMART_CATEGORIES,
  detectSmartBoundaries,
  extractPageTexts,
  parseCustomSmartPrompt,
  type SmartSplitResult,
} from "@/lib/smart-split";
import { getCategoryStyle } from "@/lib/category-colors";
import { getTool } from "@/lib/tools";
import { getCrossSellTools } from "@/lib/cross-sell";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { TrustSection } from "@/components/tool/TrustSection";
import { ToolFaqAccordion } from "@/components/tool/ToolFaqAccordion";
import type { FaqInput } from "@/lib/seo";

const tool = getTool("/split-pdf")!;

type Mode = "range" | "pages" | "size";
type RangeMode = "custom" | "fixed" | "smart";
type PagesMode = "all" | "select";

interface CustomRangeInput {
  id: string;
  from: string;
  to: string;
}

interface SplitResult {
  outputs: SplitOutput[];
  downloadBlob: Blob;
  downloadFilename: string;
}

const MODE_TABS: { id: Mode; label: string; icon: typeof Rows3 }[] = [
  { id: "range", label: "Range", icon: Rows3 },
  { id: "pages", label: "Pages", icon: Grid2x2 },
  { id: "size", label: "Size", icon: Scale },
];

const RANGE_MODE_TABS: { id: RangeMode; label: string }[] = [
  { id: "custom", label: "Custom" },
  { id: "fixed", label: "Fixed" },
  { id: "smart", label: "Smart" },
];

/** Cycling color set for the document preview's range/group badges — six
 *  colors is enough to visually distinguish adjacent groups without the
 *  cycle repeating too often on documents with many ranges. */
const RANGE_COLORS = [
  { border: "border-blue-400 dark:border-blue-600", badge: "bg-blue-600" },
  { border: "border-emerald-400 dark:border-emerald-600", badge: "bg-emerald-600" },
  { border: "border-amber-400 dark:border-amber-600", badge: "bg-amber-600" },
  { border: "border-purple-400 dark:border-purple-600", badge: "bg-purple-600" },
  { border: "border-pink-400 dark:border-pink-600", badge: "bg-pink-600" },
  { border: "border-cyan-400 dark:border-cyan-600", badge: "bg-cyan-600" },
];

function InfoNote({ tone = "info", children }: { tone?: "info" | "warning"; children: React.ReactNode }) {
  const Icon = tone === "warning" ? AlertCircle : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-2 p-2.5 rounded-lg border text-xs",
        tone === "warning"
          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200"
          : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200"
      )}
    >
      <Icon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

interface SplitResultViewProps {
  result: SplitResult;
  onDownload: () => void;
  onStartOver: () => void;
  autoDownloadedRef: React.MutableRefObject<boolean>;
}

function SplitResultView({ result, onDownload, onStartOver, autoDownloadedRef }: SplitResultViewProps) {
  useEffect(() => {
    if (!autoDownloadedRef.current) {
      autoDownloadedRef.current = true;
      onDownload();
    }
  }, [onDownload, autoDownloadedRef]);

  const multi = result.outputs.length > 1;
  const warning = result.outputs.find((o) => o.warning)?.warning;

  return (
    <div className="flex flex-col items-center text-center py-8 space-y-6">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-green-500/10 scale-150" />
        <CheckCircle2 className="h-16 w-16 text-green-500 relative" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">
          {multi ? `${result.outputs.length} PDFs created` : "Your file is ready"}
        </h2>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{result.downloadFilename}</span>
          <span className="ml-2">({formatFileSize(result.downloadBlob.size)})</span>
        </p>
      </div>

      {multi && (
        <div className="w-full max-w-sm text-left rounded-lg border divide-y max-h-48 overflow-y-auto">
          {result.outputs.map((o) => (
            <div key={o.name} className="flex items-center justify-between px-3 py-2 text-xs gap-2">
              <span className="truncate">{o.name}</span>
              <span className="text-muted-foreground shrink-0">
                {o.pageCount} pg{o.pageCount === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      )}

      {warning && (
        <div className="w-full max-w-sm text-left">
          <InfoNote tone="warning">{warning}</InfoNote>
        </div>
      )}

      <div className="flex flex-col items-center gap-3 w-full sm:w-auto pt-2">
        <Button size="lg" onClick={onDownload}>
          <Download className="h-4 w-4" />
          {multi ? "Download ZIP" : "Download PDF"}
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onStartOver}>
          <RefreshCw className="h-4 w-4" />
          Start Over
        </Button>
      </div>
    </div>
  );
}

interface SplitPdfClientProps {
  faqs: FaqInput[];
}

export function SplitPdfClient({ faqs }: SplitPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [thumbnails, setThumbnails] = useState<{ pageNumber: number; dataUrl: string }[]>([]);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [loadError, setLoadError] = useState<PdfRenderErrorKind | null>(null);

  const [mode, setMode] = useState<Mode>("range");
  const [rangeMode, setRangeMode] = useState<RangeMode>("custom");

  // Range → Custom
  const [customRanges, setCustomRanges] = useState<CustomRangeInput[]>([{ id: "r-1", from: "1", to: "1" }]);
  const [mergeRanges, setMergeRanges] = useState(false);
  const customRangesTouchedRef = useRef(false);
  const rangeIdCounter = useRef(1);

  // Range → Fixed
  const [fixedSize, setFixedSize] = useState("1");

  // Range → Smart
  const [smartCategoryId, setSmartCategoryId] = useState<string | null>(null);
  const [smartPresetId, setSmartPresetId] = useState<string | null>(null);
  const [smartCustomPrompt, setSmartCustomPrompt] = useState("");
  const [pageTexts, setPageTexts] = useState<string[] | null>(null);
  const [smartTextsLoading, setSmartTextsLoading] = useState(false);

  // Pages
  const [pagesMode, setPagesMode] = useState<PagesMode>("all");
  const [pageExpression, setPageExpression] = useState("");
  const [mergeExtracted, setMergeExtracted] = useState(false);

  // Size
  const [sizeValue, setSizeValue] = useState("10");
  const [sizeUnit, setSizeUnit] = useState<"KB" | "MB">("MB");
  const [allowCompression, setAllowCompression] = useState(true);

  const { processing, progress, failed, run, cancel } = useProcessingTask();
  const [processingLabel, setProcessingLabel] = useState("Preparing PDF…");
  const [result, setResult] = useState<SplitResult | null>(null);
  const autoDownloadRef = useRef(false);

  const style = getCategoryStyle(tool);
  const ToolIcon = tool.icon;

  // ---- File load / thumbnails --------------------------------------------

  useEffect(() => {
    if (!file) {
      setThumbnails([]);
      setPageCount(0);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setThumbLoading(true);
    setThumbnails([]);
    setLoadError(null);

    (async () => {
      try {
        await renderPdfPages(file, {
          scale: 0.35,
          onProgress: (pageNumber, totalPages) => {
            if (cancelled) return;
            if (pageNumber === 1) setPageCount(totalPages);
          },
          onPageRendered: (page) => {
            if (cancelled) return;
            setThumbLoading(false);
            setThumbnails((prev) => [...prev, { pageNumber: page.pageNumber, dataUrl: page.canvas.toDataURL("image/png") }]);
          },
        });
      } catch (error) {
        if (!cancelled) {
          setLoadError(classifyPdfRenderError(error));
          setThumbLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Default the first Custom range to the full document once the page
  // count is known, but only while the user hasn't touched ranges yet —
  // never overwrite something they've already configured.
  useEffect(() => {
    if (pageCount > 0 && !customRangesTouchedRef.current && customRanges.length === 1) {
      setCustomRanges([{ id: customRanges[0].id, from: "1", to: String(pageCount) }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount]);

  // Lazily extract page text only once Smart mode is actually opened —
  // real work (a pdfjs parse per page), not worth paying for on every file.
  useEffect(() => {
    if (rangeMode !== "smart" || !file || pageTexts !== null || pageCount === 0) return;
    let cancelled = false;
    setSmartTextsLoading(true);
    file
      .arrayBuffer()
      .then((buffer) => extractPageTexts(buffer))
      .then((texts) => {
        if (!cancelled) {
          setPageTexts(texts);
          setSmartTextsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSmartTextsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeMode, file, pageTexts, pageCount]);

  // ---- Reset / file selection ---------------------------------------------

  function resetConfiguration() {
    setMode("range");
    setRangeMode("custom");
    rangeIdCounter.current = 1;
    setCustomRanges([{ id: "r-1", from: "1", to: "1" }]);
    customRangesTouchedRef.current = false;
    setMergeRanges(false);
    setFixedSize("1");
    setSmartCategoryId(null);
    setSmartPresetId(null);
    setSmartCustomPrompt("");
    setPageTexts(null);
    setPagesMode("all");
    setPageExpression("");
    setMergeExtracted(false);
    setSizeValue("10");
    setSizeUnit("MB");
    setAllowCompression(true);
    setResult(null);
  }

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    resetConfiguration();
    setFile(newFiles[0]);
  };

  const startOver = () => {
    resetConfiguration();
    setFile(null);
  };

  // ---- Custom range helpers -----------------------------------------------

  const addRange = () => {
    customRangesTouchedRef.current = true;
    rangeIdCounter.current += 1;
    const last = customRanges[customRanges.length - 1];
    const lastTo = Number(last?.to) || 0;
    const nextFrom = Math.min(lastTo + 1, pageCount || 1);
    setCustomRanges((prev) => [...prev, { id: `r-${rangeIdCounter.current}`, from: String(nextFrom), to: String(pageCount || nextFrom) }]);
  };

  const removeRange = (id: string) => {
    customRangesTouchedRef.current = true;
    setCustomRanges((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const updateRange = (id: string, field: "from" | "to", value: string) => {
    customRangesTouchedRef.current = true;
    setCustomRanges((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const customRangesParsed = useMemo(() => {
    return customRanges.map((r) => {
      const from = Number(r.from);
      const to = Number(r.to);
      let error: string | null = null;
      if (r.from.trim() === "" || r.to.trim() === "" || !Number.isFinite(from) || !Number.isFinite(to) || !Number.isInteger(from) || !Number.isInteger(to)) {
        error = "Enter valid whole page numbers.";
      } else if (from < 1 || to < 1) {
        error = "Page numbers start at 1.";
      } else if (pageCount > 0 && (from > pageCount || to > pageCount)) {
        error = `This document only has ${pageCount} page${pageCount === 1 ? "" : "s"}.`;
      } else if (from > to) {
        error = "The start page must come before the end page.";
      }
      return { id: r.id, from, to, error };
    });
  }, [customRanges, pageCount]);

  const customRangesValid = pageCount > 0 && customRangesParsed.every((r) => !r.error);
  const customOutputCount = mergeRanges ? 1 : customRangesParsed.length;

  // ---- Fixed ---------------------------------------------------------------

  const fixedSizeNum = Number(fixedSize);
  const fixedValid = Number.isInteger(fixedSizeNum) && fixedSizeNum >= 1;
  const fixedOutputCount = fixedValid && pageCount > 0 ? computeFixedGroupCount(pageCount, fixedSizeNum) : 0;

  // ---- Smart -----------------------------------------------------------------

  const isCustomPrompt = smartCategoryId === "custom";
  const activeCategory = SMART_CATEGORIES.find((c) => c.id === smartCategoryId);
  const activePreset = activeCategory?.presets.find((p) => p.id === smartPresetId) ?? null;

  const customPromptParsed = useMemo(() => {
    if (!isCustomPrompt) return null;
    return parseCustomSmartPrompt(smartCustomPrompt);
  }, [isCustomPrompt, smartCustomPrompt]);

  const smartResult: SmartSplitResult | null = useMemo(() => {
    if (!pageTexts) return null;
    if (isCustomPrompt) {
      if (!smartCustomPrompt.trim()) return null;
      if (customPromptParsed?.error) return { groups: [], detected: false, message: customPromptParsed.error };
      if (customPromptParsed?.preset) return detectSmartBoundaries(pageTexts, customPromptParsed.preset);
      return null;
    }
    if (!activePreset) return null;
    return detectSmartBoundaries(pageTexts, activePreset);
  }, [pageTexts, isCustomPrompt, smartCustomPrompt, customPromptParsed, activePreset]);

  // ---- Pages -----------------------------------------------------------------

  const pageExprResult = useMemo(() => {
    if (pagesMode !== "select" || !pageExpression.trim() || pageCount === 0) return null;
    return parsePageExpression(pageExpression, pageCount);
  }, [pagesMode, pageExpression, pageCount]);

  const pagesOutputCount =
    pagesMode === "all"
      ? pageCount
      : mergeExtracted
        ? pageExprResult?.groups
          ? 1
          : 0
        : pageExprResult?.groups?.length ?? 0;

  // ---- Size --------------------------------------------------------------------

  const sizeBytes = useMemo(() => {
    const v = Number(sizeValue);
    if (!Number.isFinite(v) || v <= 0) return 0;
    return sizeUnit === "MB" ? v * 1024 * 1024 : v * 1024;
  }, [sizeValue, sizeUnit]);

  const sizeEstimate = file && pageCount > 0 && sizeBytes > 0 ? estimateSizeGroupCount(pageCount, file.size, sizeBytes) : 0;

  // ---- Preview grouping (document grid coloring) --------------------------

  const pageGroupMap = useMemo(() => {
    const map = new Map<number, { rangeIndex: number; label: string }>();
    if (loadError || pageCount === 0) return map;

    if (mode === "range") {
      if (rangeMode === "custom") {
        customRangesParsed.forEach((r, idx) => {
          if (r.error) return;
          for (let p = r.from; p <= r.to; p++) {
            if (!map.has(p - 1)) map.set(p - 1, { rangeIndex: idx, label: `Range ${idx + 1}` });
          }
        });
      } else if (rangeMode === "fixed" && fixedValid) {
        computeFixedPageGroups(pageCount, fixedSizeNum).forEach(([start, end], idx) => {
          for (let p = start; p <= end; p++) map.set(p - 1, { rangeIndex: idx, label: `Part ${idx + 1}` });
        });
      } else if (rangeMode === "smart" && smartResult?.detected) {
        smartResult.groups.forEach((group, idx) => {
          group.forEach((p) => map.set(p - 1, { rangeIndex: idx, label: `Range ${idx + 1}` }));
        });
      }
    } else if (mode === "pages" && pagesMode === "select" && pageExprResult?.groups) {
      pageExprResult.groups.forEach((group, idx) => {
        group.forEach((p) => map.set(p - 1, { rangeIndex: idx, label: `Group ${idx + 1}` }));
      });
    }
    return map;
  }, [mode, rangeMode, pagesMode, customRangesParsed, fixedValid, fixedSizeNum, smartResult, pageExprResult, pageCount, loadError]);

  // ---- Can-split gate -------------------------------------------------------

  const canSplit = useMemo(() => {
    if (!file || pageCount === 0 || loadError) return false;
    if (mode === "range") {
      if (rangeMode === "custom") return customRangesValid;
      if (rangeMode === "fixed") return fixedValid;
      return !!smartResult?.detected && smartResult.groups.length > 0;
    }
    if (mode === "pages") {
      if (pagesMode === "all") return pageCount > 0;
      return !!pageExprResult?.groups && pageExprResult.groups.length > 0 && !pageExprResult.error;
    }
    return sizeBytes > 0;
  }, [file, pageCount, loadError, mode, rangeMode, customRangesValid, fixedValid, smartResult, pagesMode, pageExprResult, sizeBytes]);

  // ---- Split ------------------------------------------------------------------

  const handleSplit = () => {
    if (!file || !canSplit) return;

    run(
      async (setProgress, isCancelled) => {
        setResult(null);
        autoDownloadRef.current = false;
        setProcessingLabel("Preparing PDF…");
        const buffer = await file.arrayBuffer();
        let results: SplitOutput[];

        // Real, per-unit progress — the label always names the actual unit
        // of work just completed (range/part/page group), never a number
        // disconnected from what's happening.
        const reportUnit = (unitLabel: string, mergedLabel: string, merged: boolean) => (done: number, total: number) => {
          setProgress((done / total) * 100);
          setProcessingLabel(merged ? mergedLabel : `Processing ${unitLabel} ${done} of ${total}…`);
        };

        if (mode === "range") {
          if (rangeMode === "custom") {
            results = await splitByCustomRanges(
              buffer,
              file.name,
              customRangesParsed.map((r) => ({ id: r.id, from: r.from, to: r.to })),
              mergeRanges,
              reportUnit("range", "Merging ranges…", mergeRanges)
            );
          } else if (rangeMode === "fixed") {
            results = await splitByFixedSize(buffer, file.name, fixedSizeNum, reportUnit("part", "Splitting PDF…", false));
          } else {
            const groups = smartResult!.groups;
            const ranges = groups.map((g, i) => ({ id: String(i), from: g[0], to: g[g.length - 1] }));
            results = await splitByCustomRanges(buffer, file.name, ranges, false, reportUnit("range", "Splitting PDF…", false));
          }
        } else if (mode === "pages") {
          const groups = pagesMode === "all" ? extractAllPagesGroups(pageCount) : pageExprResult!.groups!;
          const merged = pagesMode === "select" && mergeExtracted;
          results = await extractPageGroups(buffer, file.name, groups, merged, reportUnit("page group", "Merging pages…", merged));
        } else {
          let workingBytes: ArrayBuffer | Uint8Array = buffer;
          if (allowCompression) {
            setProcessingLabel("Compressing pages…");
            setProgress(5);
            workingBytes = await compressPdfForSizeSplit(buffer);
            setProgress(20);
          }
          results = await splitBySize(workingBytes, file.name, sizeBytes, ({ pagesProcessed, totalPages }) => {
            setProgress(20 + (pagesProcessed / totalPages) * 75);
            setProcessingLabel(`Measuring pages… ${pagesProcessed} of ${totalPages}`);
          });
        }

        if (isCancelled()) return;

        if (results.length > 1) {
          setProcessingLabel("Creating ZIP…");
          const { zipSync } = await import("fflate");
          const zipEntries: Record<string, Uint8Array> = {};
          const usedNames = new Set<string>();
          for (const r of results) {
            let name = r.name;
            let n = 2;
            while (usedNames.has(name)) {
              name = r.name.replace(/\.pdf$/i, `_${n}.pdf`);
              n++;
            }
            usedNames.add(name);
            zipEntries[name] = r.bytes;
          }
          const zipped = zipSync(zipEntries);
          const blob = new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
          setProcessingLabel("Finalizing files…");
          setResult({ outputs: results, downloadBlob: blob, downloadFilename: `${safeBaseName(file.name)}_split.zip` });
        } else {
          setProcessingLabel("Finalizing files…");
          const blob = new Blob([results[0].bytes as unknown as BlobPart], { type: "application/pdf" });
          setResult({ outputs: results, downloadBlob: blob, downloadFilename: results[0].name });
        }
        setProgress(100);
      },
      {
        successMessage: "PDF split successfully!",
        toolName: "split-pdf",
        errorTitle: "Failed to split PDF",
        onError: (error) => {
          console.error("Error splitting PDF:", error);
          return "Something went wrong while splitting this PDF. Your original file is still available — please try again.";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!result) return;
    downloadBlob(result.downloadBlob, result.downloadFilename);
  };

  return (
    <div className="flex-1 py-8 md:py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <Link href="/" className="flex items-center gap-2 mb-6 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        {processing ? (
          <div className="border rounded-2xl bg-white dark:bg-slate-900 py-16 px-6 max-w-md mx-auto">
            <ProcessingState progress={progress} onCancel={cancel} label={processingLabel} />
          </div>
        ) : result ? (
          <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 md:p-10 max-w-xl mx-auto">
            <SplitResultView result={result} onDownload={downloadResult} onStartOver={startOver} autoDownloadedRef={autoDownloadRef} />
          </div>
        ) : !file ? (
          // EMPTY STATE — one primary action, nothing competing with it.
          <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 md:p-10 max-w-xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-5", style.bgClass)}>
                <ToolIcon className={cn("h-7 w-7", style.iconClass)} aria-hidden />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Split PDF file</h1>
              <p className="text-muted-foreground max-w-sm mb-8">
                Separate one PDF into individual pages, or the exact ranges you choose.
              </p>
              <div className="w-full">
                <FileUpload
                  accept={{ "application/pdf": [".pdf"] }}
                  multiple={false}
                  onFilesSelected={handleFilesSelected}
                  primaryLabel="Select PDF file"
                  secondaryLabel="or drop PDF here"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_360px] gap-6 items-start">
            {/* DOCUMENT PREVIEW */}
            <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", style.bgClass)}>
                  <ToolIcon className={cn("h-5 w-5", style.iconClass)} aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                    {pageCount > 0 ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-muted-foreground shrink-0" onClick={startOver}>
                  Change file
                </Button>
              </div>

              {loadError ? (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" />
                  <div className="space-y-2">
                    <p className="text-destructive">{PDF_RENDER_ERROR_MESSAGE[loadError]}</p>
                    <Button variant="outline" size="sm" onClick={startOver}>
                      Choose a Different File
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3" role="group" aria-label="Document pages">
                    {thumbnails.map((thumb) => {
                      const info = pageGroupMap.get(thumb.pageNumber - 1);
                      const color = info ? RANGE_COLORS[info.rangeIndex % RANGE_COLORS.length] : null;
                      return (
                        <div
                          key={thumb.pageNumber}
                          className={cn(
                            "relative rounded-lg border-2 overflow-hidden bg-muted/30",
                            color ? color.border : "border-border"
                          )}
                        >
                          <div className="w-full aspect-[3/4] flex items-center justify-center overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot, not an optimizable remote asset */}
                            <img src={thumb.dataUrl} alt="" className="w-full h-auto block" />
                          </div>
                          <span className="absolute bottom-1 left-1 text-[10px] font-medium bg-background/90 text-foreground px-1.5 py-0.5 rounded">
                            {thumb.pageNumber}
                          </span>
                          {info && (
                            <span
                              className={cn(
                                "absolute top-1 left-1 text-[9px] font-semibold text-white px-1.5 py-0.5 rounded",
                                color!.badge
                              )}
                            >
                              {info.label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {thumbLoading && (
                    <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                      Loading page {thumbnails.length + 1} of {pageCount || "…"}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* SPLIT CONFIGURATION */}
            <aside className="border rounded-2xl bg-white dark:bg-slate-900 p-5 md:sticky md:top-24 space-y-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", style.bgClass)}>
                  <ToolIcon className={cn("h-5 w-5", style.iconClass)} aria-hidden />
                </div>
                <h2 className="text-lg font-semibold">Split PDF</h2>
              </div>

              {!loadError && (
                <>
                  <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Split method">
                    {MODE_TABS.map((tab) => {
                      const TabIcon = tab.icon;
                      const active = mode === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setMode(tab.id)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          )}
                        >
                          <TabIcon className="h-4 w-4" aria-hidden />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {mode === "range" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {RANGE_MODE_TABS.map((rm) => (
                          <button
                            key={rm.id}
                            type="button"
                            aria-pressed={rangeMode === rm.id}
                            onClick={() => setRangeMode(rm.id)}
                            className={cn(
                              "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              rangeMode === rm.id
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:border-primary/40"
                            )}
                          >
                            {rm.label}
                          </button>
                        ))}
                      </div>

                      {rangeMode === "custom" && (
                        <div className="space-y-3">
                          {customRangesParsed.map((r, idx) => {
                            const rawRange = customRanges.find((cr) => cr.id === r.id)!;
                            return (
                              <div key={r.id} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-muted-foreground">Range {idx + 1}</span>
                                  {customRanges.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeRange(r.id)}
                                      aria-label={`Remove range ${idx + 1}`}
                                      className="text-muted-foreground hover:text-destructive"
                                    >
                                      <X className="h-3.5 w-3.5" aria-hidden />
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="sr-only" htmlFor={`from-${r.id}`}>
                                    From page
                                  </label>
                                  <input
                                    id={`from-${r.id}`}
                                    type="number"
                                    min={1}
                                    inputMode="numeric"
                                    value={rawRange.from}
                                    onChange={(e) => updateRange(r.id, "from", e.target.value)}
                                    placeholder="From"
                                    className="w-full px-2.5 py-1.5 border rounded-md bg-background text-sm"
                                  />
                                  <span className="text-xs text-muted-foreground shrink-0">to</span>
                                  <label className="sr-only" htmlFor={`to-${r.id}`}>
                                    To page
                                  </label>
                                  <input
                                    id={`to-${r.id}`}
                                    type="number"
                                    min={1}
                                    inputMode="numeric"
                                    value={rawRange.to}
                                    onChange={(e) => updateRange(r.id, "to", e.target.value)}
                                    placeholder="To"
                                    className="w-full px-2.5 py-1.5 border rounded-md bg-background text-sm"
                                  />
                                </div>
                                {r.error && (
                                  <p className="text-xs text-destructive" role="alert">
                                    {r.error}
                                  </p>
                                )}
                              </div>
                            );
                          })}

                          <Button variant="outline" size="sm" className="w-full" onClick={addRange}>
                            <Plus className="h-3.5 w-3.5" />
                            Add Range
                          </Button>

                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={mergeRanges}
                              onChange={(e) => setMergeRanges(e.target.checked)}
                              className="h-3.5 w-3.5"
                            />
                            Merge all ranges in one PDF file
                          </label>

                          <p className="text-xs text-muted-foreground" aria-live="polite">
                            {customRangesValid
                              ? `${customOutputCount} PDF${customOutputCount === 1 ? "" : "s"} will be created.`
                              : "Fix the highlighted range above."}
                          </p>
                        </div>
                      )}

                      {rangeMode === "fixed" && (
                        <div className="space-y-3">
                          <label htmlFor="fixed-size" className="text-sm font-medium block">
                            Split into page ranges of:
                          </label>
                          <input
                            id="fixed-size"
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={fixedSize}
                            onChange={(e) => setFixedSize(e.target.value)}
                            className="w-24 px-2.5 py-1.5 border rounded-md bg-background text-sm"
                          />
                          {!fixedValid ? (
                            <p className="text-xs text-destructive">Enter a whole number of at least 1.</p>
                          ) : (
                            <InfoNote>
                              This PDF will be split into files of up to {fixedSizeNum} page{fixedSizeNum === 1 ? "" : "s"}.{" "}
                              {fixedOutputCount} PDF{fixedOutputCount === 1 ? "" : "s"} will be created.
                            </InfoNote>
                          )}
                        </div>
                      )}

                      {rangeMode === "smart" && (
                        <div className="space-y-3">
                          <label id="smart-category-label" className="text-sm font-medium block">
                            Document category
                          </label>
                          <Select
                            value={smartCategoryId ?? ""}
                            onValueChange={(value) => {
                              setSmartCategoryId(value);
                              setSmartPresetId(null);
                            }}
                          >
                            <SelectTrigger aria-labelledby="smart-category-label">
                              <SelectValue placeholder="Select a category…" />
                            </SelectTrigger>
                            <SelectContent>
                              {SMART_CATEGORIES.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.label}
                                </SelectItem>
                              ))}
                              <SelectItem value="custom">Custom prompt</SelectItem>
                            </SelectContent>
                          </Select>

                          {smartCategoryId && !isCustomPrompt && (
                            <>
                              <label id="smart-preset-label" className="text-sm font-medium block">
                                Split preset
                              </label>
                              <Select value={smartPresetId ?? ""} onValueChange={setSmartPresetId}>
                                <SelectTrigger aria-labelledby="smart-preset-label">
                                  <SelectValue placeholder="Select a preset…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {activeCategory?.presets.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {activePreset && <p className="text-xs text-muted-foreground">{activePreset.description}</p>}
                            </>
                          )}

                          {isCustomPrompt && (
                            <>
                              <label htmlFor="smart-custom-prompt" className="text-sm font-medium block">
                                Custom instruction
                              </label>
                              <textarea
                                id="smart-custom-prompt"
                                value={smartCustomPrompt}
                                onChange={(e) => setSmartCustomPrompt(e.target.value)}
                                rows={3}
                                placeholder='e.g. every 5 pages, or when a page contains "Invoice"'
                                className="w-full px-2.5 py-1.5 border rounded-md bg-background text-sm resize-none"
                              />
                              <p className="text-xs text-muted-foreground">
                                Supported: &quot;every N pages&quot;, &apos;when a page contains &quot;keyword&quot;&apos;, &apos;when
                                heading &quot;text&quot; appears&apos;, &apos;when identifier &quot;pattern&quot; changes&apos;.
                              </p>
                            </>
                          )}

                          {smartTextsLoading && <p className="text-xs text-muted-foreground">Analyzing document text…</p>}

                          {!smartTextsLoading && smartResult && (
                            smartResult.detected ? (
                              <InfoNote>
                                {smartResult.groups.length} PDF{smartResult.groups.length === 1 ? "" : "s"} will be created based
                                on the detected split points.
                              </InfoNote>
                            ) : (
                              <InfoNote tone="warning">{smartResult.message}</InfoNote>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {mode === "pages" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          aria-pressed={pagesMode === "all"}
                          onClick={() => setPagesMode("all")}
                          className={cn(
                            "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                            pagesMode === "all"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          )}
                        >
                          Extract all pages
                        </button>
                        <button
                          type="button"
                          aria-pressed={pagesMode === "select"}
                          onClick={() => setPagesMode("select")}
                          className={cn(
                            "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                            pagesMode === "select"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          )}
                        >
                          Select pages
                        </button>
                      </div>

                      {pagesMode === "all" ? (
                        <InfoNote>
                          Selected pages will be converted into separate PDF files. {pageCount} PDF{pageCount === 1 ? "" : "s"} will
                          be created.
                        </InfoNote>
                      ) : (
                        <>
                          <label htmlFor="pages-expr" className="text-sm font-medium block">
                            Pages to extract:
                          </label>
                          <input
                            id="pages-expr"
                            value={pageExpression}
                            onChange={(e) => setPageExpression(e.target.value)}
                            placeholder="example: 1,5-8"
                            className="w-full px-2.5 py-1.5 border rounded-md bg-background text-sm"
                          />
                          {pageExprResult?.error && (
                            <p className="text-xs text-destructive" role="alert">
                              {pageExprResult.error}
                            </p>
                          )}
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={mergeExtracted}
                              onChange={(e) => setMergeExtracted(e.target.checked)}
                              className="h-3.5 w-3.5"
                            />
                            Merge extracted pages into one PDF file
                          </label>
                          {!pageExprResult?.error && pageExpression.trim() && (
                            <InfoNote>
                              Selected pages will be converted into separate PDF files. {pagesOutputCount} PDF
                              {pagesOutputCount === 1 ? "" : "s"} will be created.
                            </InfoNote>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {mode === "size" && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Original file size: {formatFileSize(file.size)}
                        <br />
                        Total pages: {pageCount}
                      </p>
                      <label htmlFor="max-size-value" className="text-sm font-medium block">
                        Maximum size per file
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="max-size-value"
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={sizeValue}
                          onChange={(e) => setSizeValue(e.target.value)}
                          aria-describedby="max-size-unit-group"
                          className="w-24 px-2.5 py-1.5 border rounded-md bg-background text-sm"
                        />
                        <div id="max-size-unit-group" role="group" aria-label="Unit" className="flex rounded-md border overflow-hidden">
                          <button
                            type="button"
                            aria-pressed={sizeUnit === "KB"}
                            onClick={() => setSizeUnit("KB")}
                            className={cn(
                              "px-3 py-1.5 text-xs font-medium",
                              sizeUnit === "KB" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                            )}
                          >
                            KB
                          </button>
                          <button
                            type="button"
                            aria-pressed={sizeUnit === "MB"}
                            onClick={() => setSizeUnit("MB")}
                            className={cn(
                              "px-3 py-1.5 text-xs font-medium",
                              sizeUnit === "MB" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                            )}
                          >
                            MB
                          </button>
                        </div>
                      </div>
                      {sizeBytes <= 0 ? (
                        <p className="text-xs text-destructive">Enter a size greater than 0.</p>
                      ) : (
                        <InfoNote>
                          This PDF will be split into files no larger than {sizeValue} {sizeUnit} each. ~{sizeEstimate} PDF
                          {sizeEstimate === 1 ? "" : "s"} will be created.
                        </InfoNote>
                      )}
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={allowCompression}
                          onChange={(e) => setAllowCompression(e.target.checked)}
                          className="h-3.5 w-3.5"
                        />
                        Allow compression
                      </label>
                    </div>
                  )}

                  {failed && (
                    <InfoNote tone="warning">
                      Something went wrong while splitting this PDF. Your original file is still available — please try again.
                    </InfoNote>
                  )}

                  <Button size="lg" className="w-full" onClick={handleSplit} disabled={!canSplit}>
                    {failed ? "Try Again" : "Split PDF"}
                  </Button>
                </>
              )}
            </aside>
          </div>
        )}

        {result && (
          <div className="max-w-xl mx-auto">
            <RelatedTools title="Continue to..." tools={getCrossSellTools("split-pdf")} />
            <TrustSection />
          </div>
        )}

        <div className="max-w-6xl">
          <ToolFaqAccordion faqs={faqs} />
        </div>
      </div>
    </div>
  );
}
