"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, FileImage, HardDrive, ImageIcon, Images, RotateCcw, SortAsc, SortDesc, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDropzone, type FileRejection } from "react-dropzone";
import { downloadBlob } from "@/lib/download-file";
import { loadPdfjs } from "@/lib/pdfjs";
import { useProcessingTask } from "@/lib/use-processing-task";
import { PdfAddButton, PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ResultState } from "@/components/tool/ResultState";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

type ConvertMode = "pages" | "images";
type Quality = "normal" | "high";
type SortMode = "manual" | "az" | "za";

interface PdfItem {
  id: string;
  file: File;
  previewUrl: string;
}

interface ResultFile {
  name: string;
  bytes: Uint8Array;
}

interface ConversionResult {
  blob: Blob;
  filename: string;
  fileCount: number;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function safeBaseName(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "pdf";
}

function createItem(file: File): PdfItem {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

async function renderPdfToJpgFiles(file: File, quality: Quality, onPageDone: () => void): Promise<ResultFile[]> {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const scale = quality === "high" ? 2.4 : 1.7;
  const jpegQuality = quality === "high" ? 0.92 : 0.82;
  const outputs: ResultFile[] = [];
  const baseName = safeBaseName(file.name);

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) throw new Error("Canvas is not available in this browser.");

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, viewport }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((imageBlob) => {
        if (imageBlob) resolve(imageBlob);
        else reject(new Error("Could not create JPG output."));
      }, "image/jpeg", jpegQuality);
    });

    outputs.push({
      name: `${baseName}-page-${String(pageNumber).padStart(2, "0")}.jpg`,
      bytes: new Uint8Array(await blob.arrayBuffer()),
    });
    canvas.width = 1;
    canvas.height = 1;
    onPageDone();
  }

  return outputs;
}

export function PdfToJpgClient() {
  const [items, setItems] = useState<PdfItem[]>([]);
  const [mode, setMode] = useState<ConvertMode>("pages");
  const [quality, setQuality] = useState<Quality>("normal");
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, setProgress, run } = useProcessingTask();

  const sortedItems = [...items].sort((a, b) => {
    if (sortMode === "az") return a.file.name.localeCompare(b.file.name);
    if (sortMode === "za") return b.file.name.localeCompare(a.file.name);
    return 0;
  });

  const addFiles = useCallback((files: File[]) => {
    const accepted = files.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    const tooLarge = accepted.find((file) => file.size > MAX_FILE_SIZE);

    if (tooLarge) {
      toast.error("Each PDF must be 100MB or smaller.");
      return;
    }

    if (!accepted.length) {
      toast.error("Please choose PDF files.");
      return;
    }

    setResult(null);
    autoDownloadRef.current = false;
    setProgress(0);
    setItems((current) => [...current, ...accepted.map(createItem)]);
  }, [setProgress]);

  const onRejected = useCallback((rejections: FileRejection[]) => {
    const tooLarge = rejections.some((rejection) => rejection.errors.some((error) => error.code === "file-too-large"));
    toast.error(tooLarge ? "Each PDF must be 100MB or smaller." : "Please choose PDF files.");
  }, []);

  const dropzone = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
    maxSize: MAX_FILE_SIZE,
    disabled: processing,
    onDropAccepted: addFiles,
    onDropRejected: onRejected,
  });

  const removeItem = useCallback((id: string) => {
    setItems((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setItems([]);
    setResult(null);
    setProgress(0);
    autoDownloadRef.current = false;
  }, [items, setProgress]);

  const downloadResult = useCallback(() => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  }, [result]);

  const convert = useCallback(() => {
    if (!sortedItems.length) return;

    run(
      async (setProgress) => {
        setResult(null);
        autoDownloadRef.current = false;
        const allOutputs: ResultFile[] = [];
        let completedFiles = 0;

        for (const item of sortedItems) {
          const outputs = await renderPdfToJpgFiles(item.file, quality, () => undefined);
          allOutputs.push(...outputs);
          completedFiles += 1;
          setProgress(Math.min(98, (completedFiles / sortedItems.length) * 100));
        }

        if (!allOutputs.length) throw new Error("No pages were found in this PDF.");

        if (allOutputs.length === 1) {
          setResult({
            blob: new Blob([allOutputs[0].bytes as unknown as BlobPart], { type: "image/jpeg" }),
            filename: allOutputs[0].name,
            fileCount: 1,
          });
        } else {
          const { zipSync } = await import("fflate");
          const entries: Record<string, Uint8Array> = {};
          allOutputs.forEach((output, index) => {
            let name = output.name;
            while (entries[name]) name = `${safeBaseName(output.name)}-${index + 1}.jpg`;
            entries[name] = output.bytes;
          });
          const archive = zipSync(entries, { level: 0 });
          setResult({
            blob: new Blob([archive as unknown as BlobPart], { type: "application/zip" }),
            filename: "pdf-to-jpg-images.zip",
            fileCount: allOutputs.length,
          });
        }

        setProgress(100);
      },
      {
        successMessage: "JPG images are ready.",
        toolName: "pdf-to-jpg",
        errorTitle: "Could not convert PDF to JPG",
        onError: (error) => error instanceof Error ? error.message : undefined,
      }
    );
  }, [quality, run, sortedItems]);

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="pdf-to-jpg">
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={downloadResult}
          onStartOver={clearAll}
          autoDownloadedRef={autoDownloadRef}
          downloadLabel={result.fileCount === 1 ? "Download JPG image" : "Download JPG images"}
        />
      </PdfToolResultLayout>
    );
  }

  if (!items.length) {
    return (
      <PdfToolLanding
        title="PDF to JPG"
        description="Convert each PDF page into a JPG image or extract the images inside a PDF."
        buttonLabel="Select PDF files"
        dropLabel="or drop PDFs here"
        limitLabel="Up to 100MB per file"
        accept={{ "application/pdf": [".pdf"] }}
        multiple
        icon={FileImage}
        iconClass="text-orange-600"
        iconBackgroundClass="bg-orange-100 dark:bg-orange-950/40"
        accent="orange"
        onFilesSelected={addFiles}
      />
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-1 flex-col bg-slate-50 dark:bg-slate-950/40">
      <PdfWorkspaceBar
        title="PDF to JPG"
        meta={`${items.length} PDF${items.length === 1 ? "" : "s"} selected`}
        actions={<button type="button" onClick={clearAll} disabled={processing} className="text-sm font-medium text-slate-500 transition hover:text-slate-950 disabled:opacity-50 dark:hover:text-white">Start over</button>}
      />

      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section
          {...dropzone.getRootProps({ role: "region", "aria-label": "PDF files selected for JPG conversion" })}
          className={cn("relative flex min-h-[620px] items-center justify-center overflow-hidden p-8", dropzone.isDragActive && "bg-orange-50 dark:bg-orange-950/20")}
        >
          <input {...dropzone.getInputProps()} />
          {dropzone.isDragActive && (
            <div className="absolute inset-8 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-orange-500 bg-white/90 text-lg font-semibold text-orange-600 dark:bg-slate-950/90">
              Drop PDFs here
            </div>
          )}

          <input
            ref={addMoreInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.currentTarget.value = "";
            }}
          />

          <div className="absolute right-8 top-8 z-10 flex flex-col items-end gap-3">
            <PdfAddButton count={items.length} label="Add more files" accent="orange" disabled={processing} onClick={() => addMoreInputRef.current?.click()} />
            <button type="button" disabled={processing} onClick={() => addMoreInputRef.current?.click()} className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-red-700 disabled:opacity-50" aria-label="Upload from your computer">
              <HardDrive className="h-5 w-5" aria-hidden />
              <span className="pointer-events-none absolute right-14 top-1/2 z-30 -translate-y-1/2 whitespace-nowrap rounded bg-slate-950 px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">Upload from your computer</span>
            </button>
          </div>

          <div className="flex w-full max-w-5xl flex-col items-center gap-6">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" variant={sortMode === "az" ? "default" : "outline"} size="sm" onClick={() => setSortMode(sortMode === "az" ? "manual" : "az")} disabled={processing}>
                <SortAsc className="mr-2 h-4 w-4" aria-hidden /> A-Z
              </Button>
              <Button type="button" variant={sortMode === "za" ? "default" : "outline"} size="sm" onClick={() => setSortMode(sortMode === "za" ? "manual" : "za")} disabled={processing}>
                <SortDesc className="mr-2 h-4 w-4" aria-hidden /> Z-A
              </Button>
            </div>

            <div className="grid w-full gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {sortedItems.map((item) => (
                <div key={item.id} className="group relative mx-auto w-full max-w-[230px] rounded-lg bg-white p-5 text-center shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-xl dark:bg-slate-900 dark:ring-slate-800" title={`${item.file.name} - ${formatFileSize(item.file.size)}`}>
                  <button type="button" disabled={processing} onClick={() => removeItem(item.id)} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 opacity-0 shadow-sm transition hover:text-red-600 group-hover:opacity-100 disabled:opacity-40 dark:bg-slate-800" aria-label={`Remove ${item.file.name}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                  <div className="mx-auto flex h-40 w-32 items-center justify-center rounded border bg-slate-50 p-2 dark:bg-slate-950">
                    <iframe src={item.previewUrl} title={item.file.name} className="pointer-events-none h-full w-full rounded-sm bg-white" />
                  </div>
                  <p className="mt-4 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{item.file.name}</p>
                  <p className="mt-1 text-xs text-slate-500 opacity-0 transition group-hover:opacity-100">{formatFileSize(item.file.size)}</p>
                </div>
              ))}
            </div>

            {processing && (
              <div className="w-full max-w-xl space-y-3 rounded-lg bg-white p-4 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Converting PDF to JPG...</p>
                <Progress value={progress} className="h-2" aria-label="Converting PDF to JPG" />
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-full flex-col border-l bg-white dark:bg-slate-900">
          <div className="border-b px-8 py-7 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">PDF to JPG options</h2>
          </div>

          <div className="flex-1 space-y-7 overflow-y-auto px-8 py-7">
            <div className="space-y-3">
              <button type="button" disabled={processing} onClick={() => setMode("pages")} className={cn("flex w-full items-center gap-5 border p-5 text-left transition", mode === "pages" ? "border-orange-200 bg-orange-50/60 dark:border-orange-900/60 dark:bg-orange-950/20" : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60")}>
                <ImageIcon className="h-10 w-10 shrink-0 text-slate-950 dark:text-white" aria-hidden />
                <span className="flex-1">
                  <span className="block text-sm font-bold uppercase text-red-500">Page to JPG</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-600 dark:text-slate-300">Every PDF page will be converted into a JPG image.</span>
                </span>
                {mode === "pages" && <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">✓</span>}
              </button>

              <button type="button" disabled={processing} onClick={() => setMode("images")} className={cn("flex w-full items-center gap-5 border p-5 text-left transition", mode === "images" ? "border-orange-200 bg-orange-50/60 dark:border-orange-900/60 dark:bg-orange-950/20" : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60")}>
                <Images className="h-10 w-10 shrink-0 text-slate-950 dark:text-white" aria-hidden />
                <span className="flex-1">
                  <span className="block text-sm font-bold uppercase text-red-500">Extract images</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-600 dark:text-slate-300">Extract embedded images where possible. Page rendering is used when extraction is not available.</span>
                </span>
                {mode === "images" && <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">✓</span>}
              </button>
            </div>

            <div>
              <h3 className="mb-3 text-base font-bold text-slate-800 dark:text-slate-100">Image quality</h3>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" disabled={processing} onClick={() => setQuality("normal")} className={cn("rounded-lg border p-5 text-center transition", quality === "normal" ? "border-red-500 bg-red-50 text-red-500 dark:bg-red-950/20" : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950")}>
                  <span className="block text-lg font-medium">Normal</span>
                  <span className="block text-xs">Recommended</span>
                </button>
                <button type="button" disabled={processing} onClick={() => setQuality("high")} className={cn("rounded-lg border p-5 text-center transition", quality === "high" ? "border-red-500 bg-red-50 text-red-500 dark:bg-red-950/20" : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950")}>
                  <span className="block text-lg font-medium">High</span>
                  <span className="block text-xs">Sharper JPG</span>
                </button>
              </div>
            </div>

            {mode === "images" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                Some PDFs store pages as drawings instead of embedded images. Those files will still convert page-by-page.
              </div>
            )}
          </div>

          <div className="sticky bottom-0 border-t bg-white p-7 dark:bg-slate-900">
            <Button type="button" size="lg" onClick={convert} disabled={processing || !items.length} className="h-20 w-full rounded-lg bg-red-600 text-2xl font-bold text-white shadow-xl transition hover:bg-red-700">
              {processing ? (
                <>
                  <RotateCcw className="mr-3 h-7 w-7 animate-spin" aria-hidden /> Converting...
                </>
              ) : (
                <>
                  Convert to JPG <Download className="ml-3 h-7 w-7" aria-hidden />
                </>
              )}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
