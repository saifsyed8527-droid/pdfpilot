"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { cropPdfDocument, MIN_CROP_FRACTION, type CropRegion, type CropScope } from "@/lib/engines/pdf-crop-engine";
import { classifyPdfRenderError, PDF_RENDER_ERROR_MESSAGE, type PdfRenderErrorKind } from "@/lib/engines/pdf-render-engine";
import { loadPdfjs } from "@/lib/pdfjs";
import { getCategoryStyle } from "@/lib/category-colors";
import { getTool } from "@/lib/tools";
import { cn, formatFileSize } from "@/lib/utils";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

interface CropPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

const tool = getTool("/crop-pdf")!;
const style = getCategoryStyle(tool);

const LANDING_COPY = {
  title: "Crop PDF",
  description: "Trim PDF margins in seconds. Click and drag to select the area you want to keep.",
  buttonLabel: "Select PDF file",
  dropLabel: "or drag and drop a PDF file here",
  limitLabel: "100MB max per PDF",
};

const RENDER_SCALE = 2;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type DragMode = "create" | "move" | Handle;

interface DragState {
  mode: DragMode;
  startFrac: { x: number; y: number };
  startRegion: CropRegion | null;
}

const clampFrac = (v: number) => Math.min(1, Math.max(0, v));

function resizeRegion(start: CropRegion, handle: Handle, dx: number, dy: number): CropRegion {
  const x1 = start.xFrac;
  const y1 = start.yFrac;
  const x2 = start.xFrac + start.widthFrac;
  const y2 = start.yFrac + start.heightFrac;

  let newX1 = x1;
  let newY1 = y1;
  let newX2 = x2;
  let newY2 = y2;

  if (handle.includes("w")) newX1 = clampFrac(x1 + dx);
  if (handle.includes("e")) newX2 = clampFrac(x2 + dx);
  if (handle.includes("n")) newY1 = clampFrac(y1 + dy);
  if (handle.includes("s")) newY2 = clampFrac(y2 + dy);

  if (newX2 - newX1 < MIN_CROP_FRACTION) {
    if (handle.includes("w")) newX1 = newX2 - MIN_CROP_FRACTION;
    else newX2 = newX1 + MIN_CROP_FRACTION;
  }
  if (newY2 - newY1 < MIN_CROP_FRACTION) {
    if (handle.includes("n")) newY1 = newY2 - MIN_CROP_FRACTION;
    else newY2 = newY1 + MIN_CROP_FRACTION;
  }

  return {
    pageIndex: start.pageIndex,
    xFrac: clampFrac(newX1),
    yFrac: clampFrac(newY1),
    widthFrac: clampFrac(newX2) - clampFrac(newX1),
    heightFrac: clampFrac(newY2) - clampFrac(newY1),
  };
}

function moveRegion(start: CropRegion, dx: number, dy: number): CropRegion {
  return {
    ...start,
    xFrac: Math.min(1 - start.widthFrac, Math.max(0, start.xFrac + dx)),
    yFrac: Math.min(1 - start.heightFrac, Math.max(0, start.yFrac + dy)),
  };
}

const HANDLES: { handle: Handle; className: string; cursor: string }[] = [
  { handle: "nw", className: "-left-1.5 -top-1.5", cursor: "cursor-nwse-resize" },
  { handle: "n", className: "left-1/2 -top-1.5 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { handle: "ne", className: "-right-1.5 -top-1.5", cursor: "cursor-nesw-resize" },
  { handle: "e", className: "-right-1.5 top-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
  { handle: "se", className: "-right-1.5 -bottom-1.5", cursor: "cursor-nwse-resize" },
  { handle: "s", className: "left-1/2 -bottom-1.5 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { handle: "sw", className: "-left-1.5 -bottom-1.5", cursor: "cursor-nesw-resize" },
  { handle: "w", className: "-left-1.5 top-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
];

export function CropPdfClient({}: CropPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [loadError, setLoadError] = useState<PdfRenderErrorKind | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [region, setRegion] = useState<CropRegion | null>(null);
  const [scope, setScope] = useState<CropScope>("all");
  const [result, setResult] = useState<{ blob: Blob; pageCount: number } | null>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, failed, run, cancel } = useProcessingTask();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdfjs-dist's PDFDocumentProxy type isn't exported from the app's thin loadPdfjs() wrapper
  const pdfDocRef = useRef<any>(null);
  const pageUnscaledSizeRef = useRef<{ width: number; height: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerScrollRef = useRef<HTMLDivElement>(null);
  const pageBoxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const baseZoomComputedRef = useRef(false);
  // Guards against pdfjs's "Cannot use the same canvas during multiple
  // render() operations" error: React StrictMode's double-invoked effects,
  // or a user clicking Next/Previous again before the previous page finished
  // rendering, can both start a second render on the same canvas while the
  // first is still in flight. Cancelling the in-flight RenderTask and
  // ignoring any result that isn't from the most recent call keeps the
  // canvas and viewer state consistent no matter how renderPage overlaps.
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const renderGenerationRef = useRef(0);

  const [pageDisplaySize, setPageDisplaySize] = useState<{ width: number; height: number } | null>(null);

  const renderPage = useCallback(async (pageIndex: number) => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc) return;
    const generation = ++renderGenerationRef.current;
    renderTaskRef.current?.cancel();
    setPageLoading(true);
    try {
      const page = await pdfDoc.getPage(pageIndex + 1);
      if (generation !== renderGenerationRef.current) return;
      const unscaled = page.getViewport({ scale: 1 });
      pageUnscaledSizeRef.current = { width: unscaled.width, height: unscaled.height };

      if (!baseZoomComputedRef.current) {
        const containerWidth = viewerScrollRef.current?.clientWidth ?? 700;
        const fit = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (containerWidth - 48) / unscaled.width));
        setZoom(fit);
        baseZoomComputedRef.current = true;
      }

      const renderViewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      const task = page.render({ canvas, viewport: renderViewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch (error) {
      // A cancelled RenderTask rejects its promise by design — not a real failure.
      if (error instanceof Error && error.name === "RenderingCancelledException") return;
      throw error;
    } finally {
      if (generation === renderGenerationRef.current) setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    baseZoomComputedRef.current = false;

    (async () => {
      try {
        const pdfjsLib = await loadPdfjs();
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        if (pdfDoc.numPages < 1) throw new Error("This PDF has no pages.");
        pdfDocRef.current = pdfDoc;
        setTotalPages(pdfDoc.numPages);
        setCurrentPageIndex(0);
        setPageInput("1");
        setLoading(false);
        await renderPage(0);
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading PDF for crop:", error);
        setLoadError(classifyPdfRenderError(error));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally file-only: this must not re-run on every renderPage identity change
  }, [file]);

  // Keeps the overlay's percentage box aligned to the canvas's real CSS size.
  useEffect(() => {
    const unscaled = pageUnscaledSizeRef.current;
    if (!unscaled) return;
    setPageDisplaySize({ width: unscaled.width * zoom, height: unscaled.height * zoom });
  }, [zoom, currentPageIndex, pageLoading]);

  const goToPage = useCallback(
    async (index: number) => {
      if (index < 0 || index >= totalPages || index === currentPageIndex) return;
      setCurrentPageIndex(index);
      setPageInput(String(index + 1));
      await renderPage(index);
    },
    [totalPages, currentPageIndex, renderPage]
  );

  const handlePageInputCommit = () => {
    const n = Number(pageInput);
    if (Number.isInteger(n) && n >= 1 && n <= totalPages) {
      goToPage(n - 1);
    } else {
      setPageInput(String(currentPageIndex + 1));
    }
  };

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setTotalPages(0);
      setCurrentPageIndex(0);
      setPageInput("1");
      setRegion(null);
      setScope("all");
      setZoom(1);
      setResult(null);
      pdfDocRef.current = null;
      pageUnscaledSizeRef.current = null;
      autoDownloadRef.current = false;
    }
  };

  const clear = () => {
    setFile(null);
    setLoading(false);
    setPageLoading(false);
    setLoadError(null);
    setTotalPages(0);
    setCurrentPageIndex(0);
    setPageInput("1");
    setRegion(null);
    setScope("all");
    setZoom(1);
    setResult(null);
    pdfDocRef.current = null;
    pageUnscaledSizeRef.current = null;
    autoDownloadRef.current = false;
  };

  const getRelativePoint = (clientX: number, clientY: number) => {
    const el = pageBoxRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: clampFrac((clientX - rect.left) / rect.width),
      y: clampFrac((clientY - rect.top) / rect.height),
    };
  };

  const onPointerDownHandle = (e: ReactPointerEvent, handle: Handle) => {
    if (!region) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { mode: handle, startFrac: getRelativePoint(e.clientX, e.clientY), startRegion: region };
  };

  const onPointerDownBody = (e: ReactPointerEvent) => {
    if (!region || region.pageIndex !== currentPageIndex) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { mode: "move", startFrac: getRelativePoint(e.clientX, e.clientY), startRegion: region };
  };

  const onPointerDownBackground = (e: ReactPointerEvent) => {
    if (processing) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const start = getRelativePoint(e.clientX, e.clientY);
    dragRef.current = { mode: "create", startFrac: start, startRegion: null };
    setRegion({ pageIndex: currentPageIndex, xFrac: start.x, yFrac: start.y, widthFrac: 0, heightFrac: 0 });
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = getRelativePoint(e.clientX, e.clientY);
    const dx = point.x - drag.startFrac.x;
    const dy = point.y - drag.startFrac.y;

    if (drag.mode === "create") {
      const x = Math.min(drag.startFrac.x, point.x);
      const y = Math.min(drag.startFrac.y, point.y);
      const width = Math.abs(point.x - drag.startFrac.x);
      const height = Math.abs(point.y - drag.startFrac.y);
      setRegion({ pageIndex: currentPageIndex, xFrac: x, yFrac: y, widthFrac: width, heightFrac: height });
    } else if (drag.mode === "move" && drag.startRegion) {
      setRegion(moveRegion(drag.startRegion, dx, dy));
    } else if (drag.startRegion) {
      setRegion(resizeRegion(drag.startRegion, drag.mode as Handle, dx, dy));
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    if (drag?.mode === "create") {
      setRegion((current) => {
        if (!current) return current;
        if (current.widthFrac < MIN_CROP_FRACTION || current.heightFrac < MIN_CROP_FRACTION) {
          return drag.startRegion;
        }
        return current;
      });
    }
    dragRef.current = null;
  };

  const resetAll = () => setRegion(null);

  const canCrop = region !== null && region.widthFrac >= MIN_CROP_FRACTION && region.heightFrac >= MIN_CROP_FRACTION;

  const runCrop = () => {
    if (!file || !region || !canCrop) return;
    run(
      async (setProgress) => {
        setResult(null);
        autoDownloadRef.current = false;
        const output = await cropPdfDocument(file, region, scope, setProgress);
        setResult(output);
      },
      {
        successMessage: "PDF cropped successfully!",
        toolName: "crop-pdf",
        errorTitle: "Failed to crop PDF",
        onError: (error) => {
          console.error("Error cropping PDF:", error);
          return error instanceof Error ? error.message : "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (result) downloadBlob(result.blob, "cropped.pdf");
  };

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="crop-pdf">
        <ResultState
          resultFilename="cropped.pdf"
          fileSize={formatFileSize(result.blob.size)}
          onDownload={downloadResult}
          onStartOver={clear}
          autoDownloadedRef={autoDownloadRef}
        />
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

  const regionOnThisPage = region && region.pageIndex === currentPageIndex ? region : null;

  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50">
      <PdfWorkspaceBar
        title="Crop PDF"
        meta={<>{file.name} · {formatFileSize(file.size)}{totalPages > 0 ? ` · ${totalPages} page${totalPages === 1 ? "" : "s"}` : ""}</>}
        actions={
          <Button variant="ghost" size="sm" onClick={clear} disabled={processing}>
            Change file
          </Button>
        }
      />
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative min-h-[620px] border-b p-5 lg:border-b-0 lg:border-r lg:h-[calc(100vh-8.15rem)] lg:p-6">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Select the area to keep</p>
            <p className="mt-1 text-xs text-slate-500">Click and drag on the page. Resize using the handles.</p>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">Loading PDF…</p>
          ) : loadError ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
              <div className="space-y-2">
                <p className="text-destructive">{PDF_RENDER_ERROR_MESSAGE[loadError]}</p>
                <Button variant="outline" size="sm" onClick={clear}>
                  Choose a Different File
                </Button>
              </div>
            </div>
          ) : (
            <div
              ref={viewerScrollRef}
              className="relative flex h-[calc(100%-4.5rem)] items-start justify-center overflow-auto rounded-2xl bg-slate-200/60 p-6 dark:bg-slate-900/40"
            >
              <div
                ref={pageBoxRef}
                className="relative touch-none select-none shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]"
                style={pageDisplaySize ? { width: pageDisplaySize.width, height: pageDisplaySize.height } : undefined}
                onPointerDown={onPointerDownBackground}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <canvas ref={canvasRef} className="block h-full w-full" />

                {pageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-950/50">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Loading page…</p>
                  </div>
                )}

                {regionOnThisPage && (
                  <>
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ boxShadow: "0 0 0 9999px rgba(15,23,42,0.45)" }}
                    />
                    <div
                      className="absolute cursor-move border-2 border-orange-500"
                      style={{
                        left: `${regionOnThisPage.xFrac * 100}%`,
                        top: `${regionOnThisPage.yFrac * 100}%`,
                        width: `${regionOnThisPage.widthFrac * 100}%`,
                        height: `${regionOnThisPage.heightFrac * 100}%`,
                      }}
                      onPointerDown={onPointerDownBody}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerUp}
                    >
                      {HANDLES.map(({ handle, className, cursor }) => (
                        <div
                          key={handle}
                          onPointerDown={(e) => onPointerDownHandle(e, handle)}
                          onPointerMove={onPointerMove}
                          onPointerUp={onPointerUp}
                          onPointerCancel={onPointerUp}
                          className={cn(
                            "absolute h-4 w-4 rounded-full border-2 border-orange-500 bg-white shadow dark:bg-slate-900",
                            className,
                            cursor
                          )}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {!loading && !loadError && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.5)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
              <div className="pointer-events-auto flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={currentPageIndex === 0}
                  onClick={() => goToPage(currentPageIndex - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Current page"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={handlePageInputCommit}
                  onKeyDown={(e) => e.key === "Enter" && handlePageInputCommit()}
                  className="h-8 w-10 rounded-lg border border-slate-200 bg-transparent text-center text-xs font-medium outline-none focus:border-orange-500 dark:border-slate-700"
                />
                <span className="text-xs text-slate-400">/ {totalPages}</span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={currentPageIndex >= totalPages - 1}
                  onClick={() => goToPage(currentPageIndex + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="pointer-events-auto mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="pointer-events-auto flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <span className="w-11 text-center text-xs font-medium text-slate-600 dark:text-slate-300">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Fit to width"
                  onClick={() => {
                    baseZoomComputedRef.current = false;
                    renderPage(currentPageIndex);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[560px] lg:p-6">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-5 flex shrink-0 items-center gap-3 border-b pb-4">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.bgClass)}>
                <tool.icon className={cn("h-5 w-5", style.iconClass)} aria-hidden />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Crop options</h2>
                <p className="text-xs text-slate-500">Preview updates as you choose</p>
              </div>
            </div>

            {!loadError && (
              <>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                    Click and drag to select the area you want to keep. Resize if needed.
                  </div>

                  <button
                    type="button"
                    onClick={resetAll}
                    disabled={!region || processing}
                    className="text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline dark:text-slate-400 dark:hover:text-white"
                  >
                    Reset all
                  </button>

                  <div>
                    <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">Pages</p>
                    <div className="space-y-2">
                      <label className={cn("flex items-center gap-2.5 rounded-xl border p-3 text-sm transition-colors", scope === "all" ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "border-slate-200 dark:border-slate-700")}>
                        <input type="radio" name="crop-scope" checked={scope === "all"} onChange={() => setScope("all")} className="h-4 w-4 accent-orange-500" />
                        All pages
                      </label>
                      <label className={cn("flex items-center gap-2.5 rounded-xl border p-3 text-sm transition-colors", scope === "current" ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "border-slate-200 dark:border-slate-700")}>
                        <input type="radio" name="crop-scope" checked={scope === "current"} onChange={() => setScope("current")} className="h-4 w-4 accent-orange-500" />
                        Current page
                      </label>
                    </div>
                    {scope === "current" && region && (
                      <p className="mt-2 text-xs text-slate-500">Only page {region.pageIndex + 1} will be cropped.</p>
                    )}
                  </div>

                  {!region && (
                    <p className="text-xs text-slate-500">Draw a selection on the page to enable cropping.</p>
                  )}

                  {failed && !processing && (
                    <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <p>Couldn&apos;t crop the PDF. Please try again with a valid PDF file.</p>
                    </div>
                  )}
                </div>

                {processing ? (
                  <div className="mt-5 shrink-0">
                    <ProcessingState progress={progress} onCancel={cancel} label="Cropping PDF…" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={runCrop}
                    disabled={!canCrop}
                    className="mt-5 flex min-h-16 w-full shrink-0 items-center justify-center rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0"
                  >
                    {failed ? "Try Again" : "Crop PDF"}
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
