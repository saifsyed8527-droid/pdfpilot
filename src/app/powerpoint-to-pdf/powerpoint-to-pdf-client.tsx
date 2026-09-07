"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  X,
  RotateCw,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowDownAZ,
  ArrowUpZA,
  Presentation,
} from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize, cn } from "@/lib/utils";
import { sortFilesByName } from "@/lib/file-sort";
import { useProcessingTask } from "@/lib/use-processing-task";
import { convertPptxToPdf, inspectPptxFile } from "@/lib/engines/pptx-engine";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { getCategoryStyle } from "@/lib/category-colors";
import { getTool } from "@/lib/tools";
import { getCrossSellTools } from "@/lib/cross-sell";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { TrustSection } from "@/components/tool/TrustSection";
import { ToolFaqAccordion } from "@/components/tool/ToolFaqAccordion";
import type { FaqInput } from "@/lib/seo";

const tool = getTool("/powerpoint-to-pdf")!;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Applies an absolute page rotation to every page of a freshly-converted
 *  PDF. A real, safe operation on the OUTPUT PDF's page objects (the same
 *  `page.setRotation()` mechanism Merge PDF's rotate already uses) — not an
 *  attempt to rotate the slide content's own coordinate system before
 *  conversion, which would risk the layout-fidelity guarantees the
 *  converter otherwise makes. */
async function applyPageRotation(pdfBlob: Blob, rotationDegrees: number): Promise<Uint8Array> {
  const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
  if (rotationDegrees === 0) return bytes;
  const { PDFDocument, degrees } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes);
  for (const page of doc.getPages()) {
    page.setRotation(degrees(rotationDegrees));
  }
  return doc.save();
}

/** `safeBaseName` only strips a trailing `.pdf` (it was written for Split
 *  PDF, whose inputs are already PDFs); here the source is a `.pptx`/`.ppt`
 *  file, so that extension has to come off first or it ends up baked into
 *  the output name (e.g. "deck.pptx.pdf"). */
function pptxBaseName(filename: string): string {
  return safeBaseName(filename.replace(/\.(pptx|ppt)$/i, ""));
}

interface FileOutput {
  file: File;
  bytes: Uint8Array;
  slideCount: number;
}

interface ConvertResult {
  outputs: FileOutput[];
  downloadBlob: Blob;
  downloadFilename: string;
}

function InfoNote({ tone = "info", children }: { tone?: "info" | "warning"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 p-2.5 rounded-lg border text-xs",
        tone === "warning"
          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200"
          : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200"
      )}
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

interface FileCardProps {
  file: File;
  slideCount: number | undefined;
  thumbnail: string | null | undefined;
  error: string | undefined;
  rotation: number;
  onRotate: () => void;
  onRemove: () => void;
}

function FileCard({ file, slideCount, thumbnail, error, rotation, onRotate, onRemove }: FileCardProps) {
  return (
    <div className={cn("group relative flex flex-col rounded-xl border bg-white dark:bg-slate-900 shadow-sm", error && "border-destructive/40")}>
      <div className={cn("relative aspect-[3/4] rounded-t-xl overflow-hidden flex items-center justify-center", error ? "bg-destructive/5" : "bg-muted")}>
        {error ? (
          <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
        ) : thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- the file's own embedded thumbnail, not an optimizable remote asset
          <img
            src={thumbnail}
            alt=""
            className="h-full w-full object-contain transition-transform duration-200"
            style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
          />
        ) : (
          <Presentation
            className="h-8 w-8 text-orange-500 transition-transform duration-200"
            style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
            aria-hidden
          />
        )}

        {!error && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 has-[:focus-visible]:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onRotate}
              aria-label={`Rotate ${file.name}`}
              title="Rotate"
              className="flex items-center justify-center h-7 w-7 rounded-full bg-white/95 dark:bg-slate-800/95 border shadow text-foreground hover:text-primary transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${file.name}`}
              title="Remove this file"
              className="flex items-center justify-center h-7 w-7 rounded-full bg-white/95 dark:bg-slate-800/95 border shadow text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {error && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${file.name}`}
            title="Remove this file"
            className="absolute top-1.5 right-1.5 flex items-center justify-center h-7 w-7 rounded-full bg-white/95 dark:bg-slate-800/95 border shadow text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="p-2.5 min-w-0">
        <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {slideCount === undefined ? "…" : `${slideCount} slide${slideCount === 1 ? "" : "s"}`}
            {" · "}
            {formatFileSize(file.size)}
          </p>
        )}
      </div>
    </div>
  );
}

interface ConvertResultViewProps {
  result: ConvertResult;
  onDownload: () => void;
  onStartOver: () => void;
  autoDownloadedRef: React.MutableRefObject<boolean>;
}

function ConvertResultView({ result, onDownload, onStartOver, autoDownloadedRef }: ConvertResultViewProps) {
  useEffect(() => {
    if (!autoDownloadedRef.current) {
      autoDownloadedRef.current = true;
      onDownload();
    }
  }, [onDownload, autoDownloadedRef]);

  const multi = result.outputs.length > 1;

  return (
    <div className="flex flex-col items-center text-center py-8 space-y-6">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-green-500/10 scale-150" />
        <CheckCircle2 className="h-16 w-16 text-green-500 relative" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">
          {multi ? `${result.outputs.length} PDFs created` : "Your PDF is ready"}
        </h2>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{result.downloadFilename}</span>
          <span className="ml-2">({formatFileSize(result.downloadBlob.size)})</span>
        </p>
      </div>

      {multi && (
        <div className="w-full max-w-sm text-left rounded-lg border divide-y max-h-48 overflow-y-auto">
          {result.outputs.map((o) => (
            <div key={o.file.name} className="flex items-center justify-between px-3 py-2 text-xs gap-2">
              <span className="truncate">{o.file.name}</span>
              <span className="text-muted-foreground shrink-0">
                {o.slideCount} slide{o.slideCount === 1 ? "" : "s"}
              </span>
            </div>
          ))}
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

interface PowerpointToPdfClientProps {
  faqs: FaqInput[];
}

export function PowerpointToPdfClient({ faqs }: PowerpointToPdfClientProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [slideCounts, setSlideCounts] = useState<Map<File, number>>(new Map());
  const [thumbnails, setThumbnails] = useState<Map<File, string | null>>(new Map());
  const [fileErrors, setFileErrors] = useState<Map<File, string>>(new Map());
  const [rotations, setRotations] = useState<Map<File, number>>(new Map());

  const { processing, progress, failed, run, cancel } = useProcessingTask();
  const [processingLabel, setProcessingLabel] = useState("Converting to PDF…");
  const [result, setResult] = useState<ConvertResult | null>(null);
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
      inspectPptxFile(file)
        .then(({ slideCount, thumbnail }) => {
          setSlideCounts((prev) => new Map(prev).set(file, slideCount));
          setThumbnails((prev) => new Map(prev).set(file, thumbnail));
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Couldn't read this file";
          setFileErrors((prev) => new Map(prev).set(file, message));
        });
    });
  };

  const removeFile = (target: File) => {
    setFiles((prev) => prev.filter((f) => f !== target));
  };

  const rotateFile = (file: File) => {
    setRotations((prev) => new Map(prev).set(file, ((prev.get(file) ?? 0) + 90) % 360));
  };

  const sortFiles = (direction: "asc" | "desc") => {
    setFiles((prev) => sortFilesByName(prev, direction));
  };

  const startOver = () => {
    setFiles([]);
    setSlideCounts(new Map());
    setThumbnails(new Map());
    setFileErrors(new Map());
    setRotations(new Map());
    setResult(null);
  };

  const hasBlockingError = files.some((file) => fileErrors.has(file));
  const canConvert = files.length > 0 && !hasBlockingError;

  const handleConvert = () => {
    if (!canConvert) return;

    run(
      async (setProgress, isCancelled) => {
        setResult(null);
        autoDownloadRef.current = false;
        const totalFiles = files.length;
        // Shared across the whole batch — see loadUnicodeFonts's doc
        // comment: the same font files are fetched over the network at
        // most once per batch instead of once per file.
        const fontByteCache = new Map<string, Uint8Array>();

        const outputs: FileOutput[] = [];
        for (let idx = 0; idx < files.length; idx++) {
          if (isCancelled()) return;
          const file = files[idx];
          setProcessingLabel(totalFiles > 1 ? `Converting file ${idx + 1} of ${totalFiles}…` : "Converting to PDF…");

          const blob = await convertPptxToPdf(
            file,
            (percent) => setProgress(((idx + percent / 100) / totalFiles) * 100),
            isCancelled,
            fontByteCache
          );
          if (isCancelled()) return;

          const rotation = rotations.get(file) ?? 0;
          const bytes = await applyPageRotation(blob, rotation);
          outputs.push({ file, bytes, slideCount: slideCounts.get(file) ?? 0 });
          setProgress(((idx + 1) / totalFiles) * 100);
        }

        if (isCancelled()) return;

        if (outputs.length > 1) {
          setProcessingLabel("Creating ZIP…");
          const { zipSync } = await import("fflate");
          const zipEntries: Record<string, Uint8Array> = {};
          const usedNames = new Set<string>();
          for (const o of outputs) {
            let name = `${pptxBaseName(o.file.name)}.pdf`;
            let n = 2;
            while (usedNames.has(name)) {
              name = `${pptxBaseName(o.file.name)}_${n}.pdf`;
              n++;
            }
            usedNames.add(name);
            zipEntries[name] = o.bytes;
          }
          const zipped = zipSync(zipEntries);
          const blob = new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
          setProcessingLabel("Finalizing files…");
          setResult({ outputs, downloadBlob: blob, downloadFilename: "converted_pdfs.zip" });
        } else {
          setProcessingLabel("Finalizing…");
          const blob = new Blob([outputs[0].bytes as unknown as BlobPart], { type: "application/pdf" });
          setResult({ outputs, downloadBlob: blob, downloadFilename: `${pptxBaseName(outputs[0].file.name)}.pdf` });
        }
      },
      {
        successMessage: "Converted to PDF successfully!",
        toolName: "powerpoint-to-pdf",
        errorTitle: "Failed to convert to PDF",
        onError: (error) => {
          console.error("Error converting PowerPoint to PDF:", error);
          return error instanceof Error ? error.message : "Something went wrong — your original file is still available, please try again.";
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
            <ConvertResultView result={result} onDownload={downloadResult} onStartOver={startOver} autoDownloadedRef={autoDownloadRef} />
          </div>
        ) : files.length === 0 ? (
          <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 md:p-10 max-w-xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-5", style.bgClass)}>
                <ToolIcon className={cn("h-7 w-7", style.iconClass)} aria-hidden />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">PowerPoint to PDF</h1>
              <p className="text-muted-foreground max-w-sm mb-8">
                Turn your slides into a PDF that keeps their real layout.
              </p>
              <div className="w-full">
                <FileUpload
                  accept={{
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
                  }}
                  multiple
                  onFilesSelected={handleFilesSelected}
                  primaryLabel="Select PowerPoint files"
                  secondaryLabel="or drop PPTX files here"
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
                    slideCount={slideCounts.get(file)}
                    thumbnail={thumbnails.get(file)}
                    error={fileErrors.get(file)}
                    rotation={rotations.get(file) ?? 0}
                    onRotate={() => rotateFile(file)}
                    onRemove={() => removeFile(file)}
                  />
                ))}

                <div>
                  <input
                    ref={addMoreInputRef}
                    type="file"
                    accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
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

            {/* CONVERT ACTION */}
            <aside className="border rounded-2xl bg-white dark:bg-slate-900 p-5 md:sticky md:top-24 space-y-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", style.bgClass)}>
                  <ToolIcon className={cn("h-5 w-5", style.iconClass)} aria-hidden />
                </div>
                <h2 className="text-lg font-semibold">PowerPoint to PDF</h2>
              </div>

              <p className="text-xs text-muted-foreground">
                Each slide becomes one PDF page: text position, fonts, colors, shape fills, and images carry over.
                Tables, charts, and rotated shapes aren&apos;t reproduced yet.
              </p>

              {hasBlockingError && (
                <InfoNote tone="warning">
                  Remove or fix the marked file{fileErrors.size === 1 ? "" : "s"} before converting.
                </InfoNote>
              )}

              {failed && (
                <InfoNote tone="warning">
                  Something went wrong while converting. Your original file is still available — please try again.
                </InfoNote>
              )}

              <Button size="lg" className="w-full" onClick={handleConvert} disabled={!canConvert}>
                {failed ? "Try Again" : files.length > 1 ? `Convert ${files.length} to PDF` : "Convert to PDF"}
              </Button>
            </aside>
          </div>
        )}

        {result && (
          <div className="max-w-xl mx-auto">
            <RelatedTools title="Continue to..." tools={getCrossSellTools("powerpoint-to-pdf")} />
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
