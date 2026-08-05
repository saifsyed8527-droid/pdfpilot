"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Type,
  GripVertical,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import {
  classifyPdfRenderError,
  PDF_RENDER_ERROR_MESSAGE,
} from "@/lib/engines/pdf-render-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

/** Scale the page is rendered at for editing (roughly 108 DPI) - the same
 *  canvas pixels are what every annotation's xPx/yPx is measured against,
 *  so the page <img> is always shown at this exact pixel size (maxWidth:
 *  "none" overrides Tailwind preflight's img{max-width:100%}) rather than
 *  letting the browser shrink it to fit a narrow container. Without that,
 *  a click's screen position would land on a different canvas pixel than
 *  the one the math below assumes, silently placing text in the wrong
 *  spot - correctness here matters more than avoiding a horizontal
 *  scrollbar on narrow viewports. */
const EDIT_SCALE = 1.5;
const DEFAULT_FONT_SIZE = 18;
const DEFAULT_COLOR = "#000000";

const COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: "#000000", label: "Black" },
  { value: "#dc2626", label: "Red" },
  { value: "#2563eb", label: "Blue" },
  { value: "#16a34a", label: "Green" },
  { value: "#ca8a04", label: "Yellow" },
  { value: "#ffffff", label: "White" },
];

interface TextAnnotation {
  id: string;
  /** Canvas-pixel coordinates (top-left origin) at EDIT_SCALE - converted
   *  to bottom-left-origin PDF points only at save time. */
  xPx: number;
  yPx: number;
  text: string;
  fontSize: number;
  color: string;
}

interface EditedPage {
  pageNumber: number;
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  /** pdf-lib's page.getRotation().angle - pages other than 0 are excluded
   *  from placement (see EDIT_SCALE's comment and the file-load handler). */
  rotation: number;
}

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

interface EditPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function EditPdfClient({ faqs, related }: EditPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<EditedPage[]>([]);
  const [totalPageCount, setTotalPageCount] = useState(0);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadError, setLoadError] = useState<ReturnType<typeof classifyPdfRenderError> | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [annotationsByPage, setAnnotationsByPage] = useState<Record<number, TextAnnotation[]>>({});
  const [selectedAnnotation, setSelectedAnnotation] = useState<{ pageIndex: number; id: string } | null>(
    null
  );
  const [placingMode, setPlacingMode] = useState(false);
  const [defaultFontSize, setDefaultFontSize] = useState(DEFAULT_FONT_SIZE);
  const [defaultColor, setDefaultColor] = useState(DEFAULT_COLOR);
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const idCounter = useRef(0);
  const pageViewRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    pageIndex: number;
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const reset = () => {
    setFile(null);
    setPages([]);
    setTotalPageCount(0);
    setLoadError(null);
    setCurrentPageIndex(0);
    setAnnotationsByPage({});
    setSelectedAnnotation(null);
    setPlacingMode(false);
    setResultPdf(null);
  };

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const pdfFile = newFiles[0];
    reset();
    setFile(pdfFile);
    setLoadingPages(true);

    try {
      const { PDFDocument } = await import("pdf-lib");
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const rotations = pdf.getPages().map((p) => p.getRotation().angle);

      // Rendered page-by-page here instead of via the shared renderPdfPages
      // batch helper: verified directly (temporary debug logging, since
      // reverted) that pdfjs's page.render() hangs indefinitely - not just
      // slow, over 30s with zero progress - for a page with a non-zero
      // /Rotate value, using the exact {canvas, viewport} call shared by
      // every other consumer of this codebase's render pipeline. Since
      // placement is already disabled on rotated pages (canPlaceOnCurrentPage
      // below), those pages only need a placeholder image, not a real
      // render - skipping page.render() there avoids the hang instead of
      // working around it after the fact. getPage/getViewport are NOT part
      // of the hang (confirmed via the same logging) and are used normally
      // for every page, rotated or not, to get correct layout dimensions.
      const { loadPdfjs } = await import("@/lib/pdfjs");
      const pdfjsLib = await loadPdfjs();
      const pdfjsDoc = await pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() }).promise;
      setTotalPageCount(pdfjsDoc.numPages);

      for (let pageNumber = 1; pageNumber <= pdfjsDoc.numPages; pageNumber++) {
        const rotation = rotations[pageNumber - 1] ?? 0;
        const page = await pdfjsDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: EDIT_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (rotation === 0) {
          await page.render({ canvas, viewport }).promise;
        } else {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#f1f5f9";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#64748b";
            ctx.font = "16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Rotated page - preview unavailable", canvas.width / 2, canvas.height / 2);
          }
        }

        const edited: EditedPage = {
          pageNumber,
          dataUrl: canvas.toDataURL("image/png"),
          widthPx: canvas.width,
          heightPx: canvas.height,
          rotation,
        };
        setPages((prev) => [...prev, edited]);
      }
    } catch (error) {
      console.error("Error loading PDF for editing:", error);
      // pdf-lib's PDFDocument.load runs first (it's needed for per-page
      // rotation) and throws its own "...is encrypted..." error for
      // password-protected files before pdfjs's renderPdfPages ever runs -
      // classifyPdfRenderError only recognizes pdfjs's PasswordException,
      // so without this check an encrypted file would fall through to the
      // generic "unknown" message instead of the specific password one.
      const message = error instanceof Error ? error.message : "";
      setLoadError(message.includes("is encrypted") ? "password" : classifyPdfRenderError(error));
    } finally {
      setLoadingPages(false);
    }
  };

  const updateAnnotation = (pageIndex: number, id: string, patch: Partial<TextAnnotation>) => {
    setAnnotationsByPage((prev) => ({
      ...prev,
      [pageIndex]: (prev[pageIndex] ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const deleteAnnotation = (pageIndex: number, id: string) => {
    setAnnotationsByPage((prev) => ({
      ...prev,
      [pageIndex]: (prev[pageIndex] ?? []).filter((a) => a.id !== id),
    }));
    setSelectedAnnotation((sel) => (sel && sel.pageIndex === pageIndex && sel.id === id ? null : sel));
  };

  const currentPage = pages[currentPageIndex];
  const currentAnnotations = annotationsByPage[currentPageIndex] ?? [];
  const canPlaceOnCurrentPage = !!currentPage && currentPage.rotation === 0;

  const handlePageClick = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!placingMode) {
      setSelectedAnnotation(null);
      return;
    }
    if (!currentPage || !canPlaceOnCurrentPage) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = Math.min(Math.max(e.clientX - rect.left, 0), currentPage.widthPx - 10);
    const yPx = Math.min(Math.max(e.clientY - rect.top, 0), currentPage.heightPx - 10);
    const id = `ann-${idCounter.current++}`;

    setAnnotationsByPage((prev) => ({
      ...prev,
      [currentPageIndex]: [
        ...(prev[currentPageIndex] ?? []),
        { id, xPx, yPx, text: "", fontSize: defaultFontSize, color: defaultColor },
      ],
    }));
    setSelectedAnnotation({ pageIndex: currentPageIndex, id });
    setPlacingMode(false);
  };

  const handleDragStart = (e: ReactPointerEvent<HTMLDivElement>, pageIndex: number, id: string) => {
    e.stopPropagation();
    const containerRect = pageViewRef.current?.getBoundingClientRect();
    const annotation = annotationsByPage[pageIndex]?.find((a) => a.id === id);
    if (!containerRect || !annotation) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      pageIndex,
      id,
      offsetX: e.clientX - containerRect.left - annotation.xPx,
      offsetY: e.clientY - containerRect.top - annotation.yPx,
    };
    setSelectedAnnotation({ pageIndex, id });
  };

  const handleDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const { pageIndex, id, offsetX, offsetY } = dragState.current;
    const containerRect = pageViewRef.current?.getBoundingClientRect();
    const page = pages[pageIndex];
    if (!containerRect || !page) return;

    const xPx = Math.min(Math.max(e.clientX - containerRect.left - offsetX, 0), page.widthPx - 10);
    const yPx = Math.min(Math.max(e.clientY - containerRect.top - offsetY, 0), page.heightPx - 10);
    updateAnnotation(pageIndex, id, { xPx, yPx });
  };

  const handleDragEnd = () => {
    dragState.current = null;
  };

  const totalNonEmptyAnnotations = Object.values(annotationsByPage)
    .flat()
    .filter((a) => a.text.trim() !== "").length;

  const savePdf = () => {
    if (!file) return;
    if (totalNonEmptyAnnotations === 0) {
      toast.error("Nothing to save", { description: "Add at least one text box before saving." });
      return;
    }

    run(
      async (setProgress) => {
        setResultPdf(null);
        const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const pdfPages = pdf.getPages();

        const entries = Object.entries(annotationsByPage).filter(
          ([, annotations]) => annotations.some((a) => a.text.trim() !== "")
        );

        entries.forEach(([pageIndexStr, annotations], step) => {
          const pageIndex = Number(pageIndexStr);
          const page = pdfPages[pageIndex];
          if (!page) return;
          const { height: pageHeightPts } = page.getSize();

          annotations
            .filter((a) => a.text.trim() !== "")
            .forEach((a) => {
              const [r, g, b] = hexToRgb01(a.color);
              page.drawText(a.text, {
                x: a.xPx / EDIT_SCALE,
                y: pageHeightPts - a.yPx / EDIT_SCALE - a.fontSize,
                size: a.fontSize,
                font,
                color: rgb(r, g, b),
              });
            });

          setProgress(((step + 1) / entries.length) * 100);
        });

        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setResultPdf(blob);
      },
      {
        successMessage: "PDF saved successfully!",
        toolName: "edit-pdf",
        errorTitle: "Failed to save PDF",
        onError: (error) => {
          console.error("Error saving edited PDF:", error);
          const message = error instanceof Error ? error.message : "";
          return message.includes("is encrypted")
            ? "This PDF is password-protected. Please remove the password and try again."
            : "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "edited.pdf");
  };

  const selectedAnnotationData =
    selectedAnnotation &&
    (annotationsByPage[selectedAnnotation.pageIndex] ?? []).find((a) => a.id === selectedAnnotation.id);

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>Edit PDF</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {loadingPages && pages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                <p role="status">Rendering pages…</p>
              </div>
            )}

            {loadError && (
              <div
                className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
                role="alert"
              >
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" />
                <p className="text-destructive">{PDF_RENDER_ERROR_MESSAGE[loadError]}</p>
              </div>
            )}

            {file && pages.length > 0 && !resultPdf && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant={placingMode ? "default" : "outline"}
                    onClick={() => setPlacingMode((v) => !v)}
                    disabled={processing || !canPlaceOnCurrentPage}
                  >
                    <Type className="h-4 w-4 mr-2" aria-hidden="true" />
                    {placingMode ? "Click the page to place text" : "Add Text"}
                  </Button>

                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Previous page"
                      disabled={currentPageIndex === 0}
                      onClick={() => {
                        setCurrentPageIndex((i) => Math.max(0, i - 1));
                        setPlacingMode(false);
                        setSelectedAnnotation(null);
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground px-2 whitespace-nowrap">
                      Page {currentPageIndex + 1} of {totalPageCount || pages.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Next page"
                      disabled={currentPageIndex >= pages.length - 1}
                      onClick={() => {
                        setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1));
                        setPlacingMode(false);
                        setSelectedAnnotation(null);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {!canPlaceOnCurrentPage && currentPage && (
                  <div
                    className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
                    role="status"
                  >
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
                    <p className="text-amber-700 dark:text-amber-500">
                      This page is rotated, so adding text to it isn&apos;t supported yet. Other pages in
                      this file can still be edited.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
                  <div className="border rounded-lg overflow-auto bg-muted/30 max-h-[70vh]">
                    {currentPage && (
                      <div
                        ref={pageViewRef}
                        onPointerDown={handlePageClick}
                        style={{
                          position: "relative",
                          width: currentPage.widthPx,
                          height: currentPage.heightPx,
                          cursor: placingMode && canPlaceOnCurrentPage ? "crosshair" : "default",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot at a deliberate native pixel size, not an optimizable remote asset */}
                        <img
                          src={currentPage.dataUrl}
                          alt={`Page ${currentPage.pageNumber}`}
                          draggable={false}
                          style={{
                            display: "block",
                            width: currentPage.widthPx,
                            height: currentPage.heightPx,
                            maxWidth: "none",
                          }}
                        />

                        {currentAnnotations.map((a) => {
                          const isSelected = selectedAnnotation?.id === a.id;
                          return (
                            <div
                              key={a.id}
                              data-annotation-box
                              style={{
                                position: "absolute",
                                left: a.xPx,
                                top: a.yPx,
                              }}
                              className="group"
                            >
                              <div
                                onPointerDown={(e) => handleDragStart(e, currentPageIndex, a.id)}
                                onPointerMove={handleDragMove}
                                onPointerUp={handleDragEnd}
                                className={`absolute -left-5 -top-5 h-5 w-5 flex items-center justify-center rounded bg-primary text-primary-foreground cursor-move opacity-0 group-hover:opacity-100 touch-none ${isSelected ? "opacity-100" : ""}`}
                                aria-hidden="true"
                              >
                                <GripVertical className="h-3 w-3" />
                              </div>
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteAnnotation(currentPageIndex, a.id);
                                }}
                                aria-label="Delete text box"
                                className={`absolute -right-5 -top-5 h-5 w-5 flex items-center justify-center rounded bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 ${isSelected ? "opacity-100" : ""}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <input
                                type="text"
                                value={a.text}
                                placeholder="Type here"
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedAnnotation({ pageIndex: currentPageIndex, id: a.id });
                                }}
                                onChange={(e) => updateAnnotation(currentPageIndex, a.id, { text: e.target.value })}
                                style={{
                                  fontSize: a.fontSize * EDIT_SCALE,
                                  color: a.color,
                                  minWidth: Math.max(80, a.text.length * a.fontSize * EDIT_SCALE * 0.55),
                                }}
                                className={`bg-transparent border px-1 outline-none ${isSelected ? "border-primary" : "border-dashed border-muted-foreground/50"}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Pages</p>
                      <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible lg:max-h-[50vh] lg:overflow-y-auto pb-1">
                        {pages.map((p, index) => (
                          <button
                            key={p.pageNumber}
                            type="button"
                            onClick={() => {
                              setCurrentPageIndex(index);
                              setPlacingMode(false);
                              setSelectedAnnotation(null);
                            }}
                            aria-pressed={index === currentPageIndex}
                            aria-label={`Page ${p.pageNumber}`}
                            className={`relative shrink-0 rounded border-2 overflow-hidden w-16 lg:w-full ${index === currentPageIndex ? "border-primary" : "border-border hover:border-primary/50"}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- small nav thumbnail from an already-rendered canvas, not an optimizable remote asset */}
                            <img src={p.dataUrl} alt="" className="w-full h-auto block" />
                            <span className="absolute bottom-0.5 left-0.5 text-[9px] font-medium bg-background/90 px-1 rounded">
                              {p.pageNumber}
                            </span>
                            {(annotationsByPage[index]?.length ?? 0) > 0 && (
                              <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                            )}
                          </button>
                        ))}
                        {pages.length < totalPageCount && (
                          <div className="flex items-center justify-center py-2 text-xs text-muted-foreground shrink-0">
                            <Loader2 className="h-3 w-3 animate-spin mr-1" /> Loading…
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 border rounded-lg p-3">
                      <p className="text-sm font-medium">
                        {selectedAnnotationData ? "Text box style" : "Default style for new text"}
                      </p>

                      <div className="space-y-1">
                        <label htmlFor="edit-pdf-font-size" className="text-xs text-muted-foreground">
                          Font size
                        </label>
                        <input
                          id="edit-pdf-font-size"
                          type="number"
                          min={8}
                          max={96}
                          value={selectedAnnotationData ? selectedAnnotationData.fontSize : defaultFontSize}
                          onChange={(e) => {
                            const size = Math.min(96, Math.max(8, Number(e.target.value) || DEFAULT_FONT_SIZE));
                            if (selectedAnnotation) {
                              updateAnnotation(selectedAnnotation.pageIndex, selectedAnnotation.id, {
                                fontSize: size,
                              });
                            } else {
                              setDefaultFontSize(size);
                            }
                          }}
                          className="w-full px-2 py-1.5 border rounded-md bg-background text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="edit-pdf-color" className="text-xs text-muted-foreground">
                          Color
                        </label>
                        <Select
                          value={selectedAnnotationData ? selectedAnnotationData.color : defaultColor}
                          onValueChange={(v) => {
                            if (selectedAnnotation) {
                              updateAnnotation(selectedAnnotation.pageIndex, selectedAnnotation.id, {
                                color: v,
                              });
                            } else {
                              setDefaultColor(v);
                            }
                          }}
                        >
                          <SelectTrigger id="edit-pdf-color">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COLOR_OPTIONS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className="h-3 w-3 rounded-full border"
                                    style={{ backgroundColor: c.value }}
                                    aria-hidden="true"
                                  />
                                  {c.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedAnnotationData && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => deleteAnnotation(selectedAnnotation!.pageIndex, selectedAnnotation!.id)}
                        >
                          <X className="h-3 w-3 mr-1" /> Delete this text box
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {processing && <Progress value={progress} className="h-2" aria-label="Saving PDF" />}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={savePdf} disabled={processing}>
                    Save PDF
                  </Button>
                  <Button variant="outline" onClick={reset} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {resultPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">PDF saved successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    Edit Another PDF
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle asChild className="text-xl md:text-2xl"><h2>Frequently Asked Questions</h2></CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="font-semibold mb-1">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <ToolRelatedContent items={related} />
      </div>
    </div>
  );
}
