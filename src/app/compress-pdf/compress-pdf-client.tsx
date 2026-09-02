"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, X, Download, RefreshCw, CheckCircle2, AlertCircle, Info, ArrowDownAZ, ArrowUpZA, FileText, Lock } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize, cn } from "@/lib/utils";
import { sortFilesByName } from "@/lib/file-sort";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  renderFirstPageThumbnailWithInfo,
  classifyPdfRenderError,
} from "@/lib/engines/pdf-render-engine";
import { compressPdfPagesWithGuard } from "@/lib/engines/pdf-compress-engine";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { getCategoryStyle } from "@/lib/category-colors";
import { getTool } from "@/lib/tools";
import { getCrossSellTools } from "@/lib/cross-sell";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { TrustSection } from "@/components/tool/TrustSection";
import { ToolFaqAccordion } from "@/components/tool/ToolFaqAccordion";
import type { FaqInput } from "@/lib/seo";

const tool = getTool("/compress-pdf")!;

type QualityLevel = "low" | "medium" | "high";
type FileError = "password" | "unreadable";

interface QualityOption {
  id: QualityLevel;
  label: string;
  description: string;
  scale: number;
  jpegQuality: number;
}

const QUALITY_OPTIONS: QualityOption[] = [
  { id: "low", label: "Extreme Compression", description: "Less quality, high compression", scale: 0.6, jpegQuality: 0.5 },
  { id: "medium", label: "Recommended Compression", description: "Good quality, good compression", scale: 0.8, jpegQuality: 0.7 },
  { id: "high", label: "Less Compression", description: "High quality, less compression", scale: 1.0, jpegQuality: 0.92 },
];

/** Matches FileUpload's own default `maxSize` — the initial upload already
 *  enforces this via react-dropzone, but "Add files" uses a plain hidden
 *  input (matching merge-pdf's own add-more pattern) that bypasses that
 *  validation entirely, so it's re-checked here for every file, from
 *  either entry point. */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Runs `worker` over `items` with at most `limit` running concurrently —
 *  compressing multiple files is independent, CPU-bound work per file
 *  (separate pdfjs document + canvas each), so running a few at once is a
 *  real, measurable win for batches without unboundedly spawning work for
 *  a 50-file upload. */
async function withConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

interface FileOutput {
  file: File;
  bytes: Uint8Array;
  originalSize: number;
  keptOriginal: boolean;
}

interface CompressResult {
  outputs: FileOutput[];
  downloadBlob: Blob;
  downloadFilename: string;
}

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

interface FileCardProps {
  file: File;
  pageCount: number | undefined;
  thumbnail: string | undefined | null;
  error: FileError | undefined;
  onRemove: () => void;
}

function FileCard({ file, pageCount, thumbnail, error, onRemove }: FileCardProps) {
  return (
    <div className={cn("group relative flex flex-col rounded-xl border bg-white dark:bg-slate-900 shadow-sm", error && "border-destructive/40")}>
      <div className={cn("relative aspect-[3/4] rounded-t-xl overflow-hidden", error ? "bg-destructive/5" : "bg-muted")}>
        {error === "password" ? (
          <div className="h-full w-full flex items-center justify-center">
            <Lock className="h-6 w-6 text-destructive" aria-hidden />
          </div>
        ) : thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot, not an optimizable remote asset
          <img src={thumbnail} alt="" className="h-full w-full object-contain" />
        ) : thumbnail === null ? (
          <div className="h-full w-full flex items-center justify-center">
            <FileText className={cn("h-6 w-6", error ? "text-destructive" : "text-muted-foreground")} aria-hidden />
          </div>
        ) : (
          <div className="h-full w-full animate-pulse bg-muted-foreground/10" aria-hidden />
        )}

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          title="Remove this file"
          className="absolute top-1.5 right-1.5 flex items-center justify-center h-7 w-7 rounded-full bg-white/95 dark:bg-slate-800/95 border shadow text-destructive opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 has-[:focus-visible]:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-2.5 min-w-0">
        <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
        {error === "password" ? (
          <p className="text-xs text-destructive">Password protected</p>
        ) : error === "unreadable" ? (
          <p className="text-xs text-destructive">Couldn&apos;t read this file</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {pageCount === undefined ? "…" : `${pageCount} page${pageCount === 1 ? "" : "s"}`}
            {" · "}
            {formatFileSize(file.size)}
          </p>
        )}
      </div>
    </div>
  );
}

interface CompressResultViewProps {
  result: CompressResult;
  onDownload: () => void;
  onStartOver: () => void;
  autoDownloadedRef: React.MutableRefObject<boolean>;
}

function CompressResultView({ result, onDownload, onStartOver, autoDownloadedRef }: CompressResultViewProps) {
  useEffect(() => {
    if (!autoDownloadedRef.current) {
      autoDownloadedRef.current = true;
      onDownload();
    }
  }, [onDownload, autoDownloadedRef]);

  const multi = result.outputs.length > 1;
  const totalOriginal = result.outputs.reduce((sum, o) => sum + o.originalSize, 0);
  const totalCompressed = result.outputs.reduce((sum, o) => sum + o.bytes.length, 0);
  const savedPct = totalCompressed < totalOriginal ? Math.round(((totalOriginal - totalCompressed) / totalOriginal) * 100) : 0;
  const allKeptOriginal = result.outputs.every((o) => o.keptOriginal);

  return (
    <div className="flex flex-col items-center text-center py-8 space-y-6">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-green-500/10 scale-150" />
        <CheckCircle2 className="h-16 w-16 text-green-500 relative" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">
          {multi ? `${result.outputs.length} PDFs compressed` : "Your PDF is ready"}
        </h2>
        {allKeptOriginal ? (
          <p className="text-muted-foreground max-w-sm">
            {multi ? "These files were" : "This file was"} already well optimized — size kept unchanged rather than made larger.
          </p>
        ) : savedPct > 0 ? (
          <p className="text-muted-foreground">
            <span className="font-medium text-green-600 dark:text-green-500">{savedPct}% smaller</span>
            <span className="ml-2">
              {formatFileSize(totalOriginal)} → {formatFileSize(totalCompressed)}
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">Size is essentially unchanged for this file.</p>
        )}
      </div>

      {multi && (
        <div className="w-full max-w-sm text-left rounded-lg border divide-y max-h-48 overflow-y-auto">
          {result.outputs.map((o) => {
            const pct = o.bytes.length < o.originalSize ? Math.round(((o.originalSize - o.bytes.length) / o.originalSize) * 100) : 0;
            return (
              <div key={o.file.name} className="flex items-center justify-between px-3 py-2 text-xs gap-2">
                <span className="truncate">{o.file.name}</span>
                <span className="text-muted-foreground shrink-0">{o.keptOriginal ? "unchanged" : `-${pct}%`}</span>
              </div>
            );
          })}
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

interface CompressPdfClientProps {
  faqs: FaqInput[];
}

export function CompressPdfClient({ faqs }: CompressPdfClientProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [pageCounts, setPageCounts] = useState<Map<File, number>>(new Map());
  const [thumbnails, setThumbnails] = useState<Map<File, string | null>>(new Map());
  const [fileErrors, setFileErrors] = useState<Map<File, FileError>>(new Map());
  const [quality, setQuality] = useState<QualityLevel>("medium");

  const { processing, progress, failed, run, cancel } = useProcessingTask();
  const [processingLabel, setProcessingLabel] = useState("Compressing PDF…");
  const [result, setResult] = useState<CompressResult | null>(null);
  const autoDownloadRef = useRef(false);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  const style = getCategoryStyle(tool);
  const ToolIcon = tool.icon;

  const handleFilesSelected = (selectedFiles: File[]) => {
    const oversized = selectedFiles.filter((f) => f.size > MAX_FILE_SIZE);
    const newFiles = selectedFiles.filter((f) => f.size <= MAX_FILE_SIZE);

    oversized.forEach((file) => {
      toast.error("File is too large", {
        description: `${file.name} exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
    });

    if (newFiles.length === 0) return;

    setFiles((prev) => [...prev, ...newFiles]);
    setResult(null);

    newFiles.forEach((file) => {
      renderFirstPageThumbnailWithInfo(file)
        .then(({ thumbnail, pageCount }) => {
          setThumbnails((prev) => new Map(prev).set(file, thumbnail));
          setPageCounts((prev) => new Map(prev).set(file, pageCount));
        })
        .catch((error) => {
          const kind = classifyPdfRenderError(error);
          setFileErrors((prev) => new Map(prev).set(file, kind === "password" ? "password" : "unreadable"));
          setThumbnails((prev) => new Map(prev).set(file, null));
        });
    });
  };

  const removeFile = (target: File) => {
    setFiles((prev) => prev.filter((f) => f !== target));
  };

  const sortFiles = (direction: "asc" | "desc") => {
    setFiles((prev) => sortFilesByName(prev, direction));
  };

  const startOver = () => {
    setFiles([]);
    setPageCounts(new Map());
    setThumbnails(new Map());
    setFileErrors(new Map());
    setQuality("medium");
    setResult(null);
  };

  const hasBlockingError = files.some((file) => fileErrors.has(file));
  const canCompress = files.length > 0 && !hasBlockingError;

  const handleCompress = () => {
    if (!canCompress) return;

    run(
      async (setProgress, isCancelled) => {
        setResult(null);
        autoDownloadRef.current = false;
        const settings = QUALITY_OPTIONS.find((q) => q.id === quality)!;
        setProcessingLabel(files.length > 1 ? `Compressing 0 of ${files.length} files…` : "Compressing PDF…");

        let completed = 0;
        const outputs = await withConcurrency(files, 3, async (file) => {
          const buffer = await file.arrayBuffer();
          const guarded = await compressPdfPagesWithGuard(buffer, settings.scale, settings.jpegQuality, (done, total) => {
            if (files.length === 1) setProcessingLabel(`Compressing page ${done} of ${total}…`);
          });
          completed++;
          setProgress((completed / files.length) * 100);
          if (files.length > 1) setProcessingLabel(`Compressed ${completed} of ${files.length} files…`);
          return { file, bytes: guarded.bytes, originalSize: file.size, keptOriginal: guarded.keptOriginal };
        });

        if (isCancelled()) return;

        if (outputs.length > 1) {
          setProcessingLabel("Creating ZIP…");
          const { zipSync } = await import("fflate");
          const zipEntries: Record<string, Uint8Array> = {};
          const usedNames = new Set<string>();
          for (const o of outputs) {
            let name = `${safeBaseName(o.file.name)}_compressed.pdf`;
            let n = 2;
            while (usedNames.has(name)) {
              name = `${safeBaseName(o.file.name)}_compressed_${n}.pdf`;
              n++;
            }
            usedNames.add(name);
            zipEntries[name] = o.bytes;
          }
          const zipped = zipSync(zipEntries);
          const blob = new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
          setProcessingLabel("Finalizing files…");
          setResult({ outputs, downloadBlob: blob, downloadFilename: "compressed_pdfs.zip" });
        } else {
          setProcessingLabel("Finalizing…");
          const blob = new Blob([outputs[0].bytes as unknown as BlobPart], { type: "application/pdf" });
          setResult({ outputs, downloadBlob: blob, downloadFilename: `${safeBaseName(outputs[0].file.name)}_compressed.pdf` });
        }
      },
      {
        successMessage: "PDF compressed successfully!",
        toolName: "compress-pdf",
        errorTitle: "Failed to compress PDF",
        onError: (error) => {
          console.error("Error compressing PDF:", error);
          return "Something went wrong while compressing this PDF. Your original file is still available — please try again.";
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
            <CompressResultView result={result} onDownload={downloadResult} onStartOver={startOver} autoDownloadedRef={autoDownloadRef} />
          </div>
        ) : files.length === 0 ? (
          <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 md:p-10 max-w-xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-5", style.bgClass)}>
                <ToolIcon className={cn("h-7 w-7", style.iconClass)} aria-hidden />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Compress PDF</h1>
              <p className="text-muted-foreground max-w-sm mb-8">
                Reduce your PDF file size while keeping good quality.
              </p>
              <div className="w-full">
                <FileUpload
                  accept={{ "application/pdf": [".pdf"] }}
                  multiple
                  onFilesSelected={handleFilesSelected}
                  primaryLabel="Select PDF file"
                  secondaryLabel="or drop PDF here"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_320px] gap-6 items-start">
            {/* WORKSPACE */}
            <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 md:p-8">
              {files.length > 1 && (
                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                  <p className="text-sm text-muted-foreground">{files.length} files</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => sortFiles("asc")}>
                      <ArrowDownAZ className="h-3.5 w-3.5" />
                      A–Z
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => sortFiles("desc")}>
                      <ArrowUpZA className="h-3.5 w-3.5" />
                      Z–A
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {files.map((file) => (
                  <FileCard
                    key={file.name + file.size + file.lastModified}
                    file={file}
                    pageCount={pageCounts.get(file)}
                    thumbnail={thumbnails.get(file)}
                    error={fileErrors.get(file)}
                    onRemove={() => removeFile(file)}
                  />
                ))}

                <div>
                  <input
                    ref={addMoreInputRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const selected = Array.from(event.target.files ?? []);
                      if (selected.length > 0) handleFilesSelected(selected);
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addMoreInputRef.current?.click()}
                    aria-label="Add more files"
                    title="Add more files"
                    className="flex flex-col items-center justify-center gap-2 aspect-[3/4] w-full rounded-xl border-2 border-dashed text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <Plus className="h-6 w-6" aria-hidden />
                    <span className="text-sm font-medium">Add files</span>
                  </button>
                </div>
              </div>
            </div>

            {/* COMPRESSION LEVEL + ACTION */}
            <aside className="border rounded-2xl bg-white dark:bg-slate-900 p-5 md:sticky md:top-24 space-y-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", style.bgClass)}>
                  <ToolIcon className={cn("h-5 w-5", style.iconClass)} aria-hidden />
                </div>
                <h2 className="text-lg font-semibold">Compression level</h2>
              </div>

              <div className="space-y-2" role="radiogroup" aria-label="Compression level">
                {QUALITY_OPTIONS.map((option) => {
                  const selected = quality === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setQuality(option.id)}
                      className={cn(
                        "w-full text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-sm font-medium", selected && "text-primary")}>{option.label}</span>
                        {selected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" aria-hidden />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                    </button>
                  );
                })}
              </div>

              {hasBlockingError && (
                <InfoNote tone="warning">
                  Remove or fix the marked file{fileErrors.size === 1 ? "" : "s"} before compressing.
                </InfoNote>
              )}

              {failed && (
                <InfoNote tone="warning">
                  Something went wrong while compressing. Your original file is still available — please try again.
                </InfoNote>
              )}

              <Button size="lg" className="w-full" onClick={handleCompress} disabled={!canCompress}>
                {failed ? "Try Again" : files.length > 1 ? `Compress ${files.length} PDFs` : "Compress PDF"}
              </Button>
            </aside>
          </div>
        )}

        {result && (
          <div className="max-w-xl mx-auto">
            <RelatedTools title="Continue to..." tools={getCrossSellTools("compress-pdf")} />
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
