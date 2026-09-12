"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, FileText, Info, Presentation, Search, X } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { cn, formatFileSize } from "@/lib/utils";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getPdfBasicInfo } from "@/lib/engines/pdf-engine";
import { renderFirstPageThumbnailWithInfo } from "@/lib/engines/pdf-render-engine";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { PdfAddButton, PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import type { ResolvedEntity } from "@/lib/content/registry";
import type { PDFPageProxy } from "pdfjs-dist";

interface PdfToPowerpointClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

interface PptxResult {
  blob: Blob;
  filename: string;
  pageCount: number;
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  hasEOL: boolean;
}

interface TextLine {
  text: string;
  xPt: number;
  yPt: number;
  fontSizePt: number;
  widthPt: number;
}

function outputName(file: File, extension: string) {
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "converted";
  return `${base}.${extension}`;
}

function groupTextIntoLines(items: PdfTextItem[]): TextLine[] {
  const lines: TextLine[] = [];
  let buffer = "";
  let startX = 0;
  let startY = 0;
  let fontSize = 12;
  let endX = 0;
  let open = false;

  const flush = () => {
    if (open && buffer.trim()) {
      lines.push({ text: buffer, xPt: startX, yPt: startY, fontSizePt: fontSize, widthPt: Math.max(endX - startX, fontSize) });
    }
    buffer = "";
    open = false;
  };

  for (const item of items) {
    if (item.str) {
      if (!open) {
        startX = item.transform[4];
        startY = item.transform[5];
        fontSize = Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 12;
        open = true;
      }
      buffer += item.str;
      endX = item.transform[4] + item.width;
    }
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

function paintWhite(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

async function renderPageUpright(page: PDFPageProxy, scale: number, rotationDeg: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const rawCanvas = document.createElement("canvas");
  rawCanvas.width = viewport.width;
  rawCanvas.height = viewport.height;
  const rawCtx = rawCanvas.getContext("2d");
  if (rawCtx) {
    rawCtx.fillStyle = "#ffffff";
    rawCtx.fillRect(0, 0, rawCanvas.width, rawCanvas.height);
  }
  await page.render({ canvas: rawCanvas, viewport }).promise;
  paintWhite(rawCanvas);

  if (rotationDeg === 0) return rawCanvas;

  const swapped = rotationDeg === 90 || rotationDeg === 270;
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = swapped ? rawCanvas.height : rawCanvas.width;
  finalCanvas.height = swapped ? rawCanvas.width : rawCanvas.height;
  const ctx = finalCanvas.getContext("2d");
  if (!ctx) return rawCanvas;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
  ctx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.drawImage(rawCanvas, -rawCanvas.width / 2, -rawCanvas.height / 2);
  return finalCanvas;
}

async function stripPageRotations(file: File): Promise<{ bytes: Uint8Array; rotations: number[] }> {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  const rotations = pages.map((p) => p.getRotation().angle);
  pages.forEach((p) => p.setRotation(degrees(0)));
  const bytes = await pdf.save();
  return { bytes, rotations };
}

function fitContain(canvas: HTMLCanvasElement, slideW: number, slideH: number) {
  const imageRatio = canvas.width / canvas.height;
  const slideRatio = slideW / slideH;
  if (imageRatio > slideRatio) {
    const w = slideW;
    const h = slideW / imageRatio;
    return { x: 0, y: (slideH - h) / 2, w, h };
  }
  const h = slideH;
  const w = slideH * imageRatio;
  return { x: (slideW - w) / 2, y: 0, w, h };
}

function FileCard({ file, pageCount, thumbnail, onRemove }: { file: File; pageCount?: number; thumbnail?: string | null; onRemove: () => void }) {
  return (
    <article className="group relative flex min-h-[302px] w-[234px] flex-col rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] transition-shadow hover:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-slate-900">
      <div className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {formatFileSize(file.size)}
        {pageCount ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}
      </div>
      <span className="absolute left-2 top-2 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[11px] font-semibold text-white shadow">1</span>
      <div className="relative flex h-[236px] items-center justify-center overflow-hidden rounded-xl bg-muted">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- local canvas snapshot preview
          <img src={thumbnail} alt="" className="h-full w-full object-contain" />
        ) : thumbnail === null ? (
          <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
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
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 min-w-0 border-t border-slate-100 pt-2 dark:border-slate-800">
        <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {pageCount === undefined ? "Reading PDF…" : `${pageCount} page${pageCount === 1 ? "" : "s"}`}
          {" · "}
          {formatFileSize(file.size)}
        </p>
      </div>
    </article>
  );
}

function QualityCard({ icon: Icon, title, children, tone = "blue" }: { icon: typeof Info; title: string; children: React.ReactNode; tone?: "blue" | "amber" | "green" }) {
  const styles = {
    blue: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200",
    amber: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
  }[tone];
  return (
    <div className={cn("rounded-2xl border p-4 text-sm", styles)}>
      <div className="flex gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">{title}</p>
          <div className="mt-1 leading-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function PdfToPowerpointClient({ faqs: _faqs, related: _related }: PdfToPowerpointClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null | undefined>(undefined);
  const [pageCount, setPageCount] = useState<number | undefined>(undefined);
  const [result, setResult] = useState<PptxResult | null>(null);
  const [processingLabel, setProcessingLabel] = useState("Converting PDF to PowerPoint…");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask();

  useEffect(() => {
    if (!file) return;
    let alive = true;
    setThumbnail(undefined);
    setPageCount(undefined);
    renderFirstPageThumbnailWithInfo(file, 0.34)
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
    setFile(next);
    setResult(null);
    autoDownloadRef.current = false;
  };

  const clear = () => {
    setFile(null);
    setResult(null);
    setThumbnail(undefined);
    setPageCount(undefined);
    autoDownloadRef.current = false;
  };

  const convertToPowerpoint = () => {
    if (!file) return;
    run(
      async (setProgress, isCancelled) => {
        setResult(null);
        autoDownloadRef.current = false;
        setProcessingLabel("Reading PDF pages…");

        const { firstPageSize } = await getPdfBasicInfo(file);
        const layoutWidthIn = firstPageSize.width / 72;
        const layoutHeightIn = firstPageSize.height / 72;

        const PptxGenJS = (await import("pptxgenjs")).default;
        const pptx = new PptxGenJS();
        pptx.author = "PDF Pilot";
        pptx.subject = "Converted from PDF";
        pptx.title = file.name;
        pptx.company = "PDF Pilot";
        pptx.defineLayout({ name: "PDF_PAGE", width: layoutWidthIn, height: layoutHeightIn });
        pptx.layout = "PDF_PAGE";

        const { loadPdfjs } = await import("@/lib/pdfjs");
        const pdfjsLib = await loadPdfjs();
        const { bytes: unrotatedBytes, rotations } = await stripPageRotations(file);
        const pdfDoc = await pdfjsLib.getDocument({ data: unrotatedBytes }).promise;
        const totalPages = pdfDoc.numPages;

        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
          if (isCancelled()) return;
          setProcessingLabel(`Creating slide ${pageNumber} of ${totalPages}…`);
          const page = await pdfDoc.getPage(pageNumber);
          const rotationDeg = rotations[pageNumber - 1] ?? 0;
          const renderScale = 2.45;
          const canvas = await renderPageUpright(page, renderScale, rotationDeg);
          const imageBox = fitContain(canvas, layoutWidthIn, layoutHeightIn);
          const pageWidthPt = canvas.width / renderScale;
          const pageHeightPt = canvas.height / renderScale;

          const slide = pptx.addSlide();
          slide.background = { color: "FFFFFF" };
          slide.addImage({
            data: canvas.toDataURL("image/jpeg", 0.92),
            x: imageBox.x,
            y: imageBox.y,
            w: imageBox.w,
            h: imageBox.h,
          });

          if (rotationDeg === 0) {
            const textContent = await page.getTextContent();
            const items = textContent.items.filter((item) => "str" in item).map((item) => item as unknown as PdfTextItem);
            const lines = groupTextIntoLines(items);
            for (const line of lines) {
              const xIn = imageBox.x + (line.xPt / pageWidthPt) * imageBox.w;
              const yIn = imageBox.y + ((pageHeightPt - line.yPt - line.fontSizePt) / pageHeightPt) * imageBox.h;
              const wIn = Math.max((line.widthPt / pageWidthPt) * imageBox.w, 0.08);
              const hIn = Math.max(((line.fontSizePt * 1.35) / pageHeightPt) * imageBox.h, 0.04);
              slide.addText(line.text, {
                x: xIn,
                y: yIn,
                w: wIn,
                h: hIn,
                fontSize: Math.min(400, Math.max(1, line.fontSizePt)),
                color: "000000",
                transparency: 100,
                margin: 0,
                valign: "top",
                breakLine: false,
                fit: "shrink",
              });
            }
          }

          setProgress(8 + (pageNumber / totalPages) * 82);
        }

        if (isCancelled()) return;
        setProcessingLabel("Packaging PowerPoint file…");
        const blob = (await pptx.write({ outputType: "blob" })) as Blob;
        setProgress(100);
        setResult({ blob, filename: outputName(file, "pptx"), pageCount: totalPages });
      },
      {
        successMessage: "Converted to PowerPoint successfully!",
        toolName: "pdf-to-powerpoint",
        errorTitle: "Failed to convert to PowerPoint",
        onError: (error) => {
          console.error("Error converting PDF to PowerPoint:", error);
          const message = error instanceof Error ? error.message : "";
          return message.includes("is encrypted")
            ? "This PDF is password-protected. Please remove the password and try again."
            : "Please try again with a valid PDF file.";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  };

  if (!file && !result) {
    return (
      <PdfToolLanding
        title="Convert PDF to PowerPoint"
        description="Turn every PDF page into a clean PowerPoint slide with high visual fidelity and searchable text."
        buttonLabel="Select PDF file"
        dropLabel="or drop PDF here"
        limitLabel="PDF up to 100MB"
        accept={{ "application/pdf": [".pdf"] }}
        multiple={false}
        icon={Presentation}
        iconClass="text-red-600"
        iconBackgroundClass="bg-red-100 dark:bg-red-950/30"
        accent="orange"
        onFilesSelected={chooseFile}
      />
    );
  }

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="pdf-to-powerpoint">
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={downloadResult}
          downloadLabel="Download PowerPoint"
          onStartOver={clear}
          autoDownloadedRef={autoDownloadRef}
        />
        <div className="mx-auto -mt-2 max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Created {result.pageCount} slide{result.pageCount === 1 ? "" : "s"}. Each slide keeps the PDF page as a high-quality visual layer with searchable text added on top.
        </div>
      </PdfToolResultLayout>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-slate-50 dark:bg-slate-950">
      <PdfWorkspaceBar
        title="PDF to PowerPoint"
        meta={file ? `${file.name} · ${pageCount ?? "…"} page${pageCount === 1 ? "" : "s"}` : "Choose a PDF"}
        actions={<PdfAddButton count={file ? 1 : undefined} label="Replace PDF file" accent="orange" disabled={processing} onClick={() => inputRef.current?.click()} />}
      />
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => chooseFile(Array.from(event.target.files ?? []))} />

      <div className="container mx-auto grid max-w-[1500px] flex-1 gap-6 px-4 py-8 lg:grid-cols-[1fr_420px]">
        <section className="relative flex min-h-[560px] items-center justify-center rounded-3xl border border-slate-200 bg-white/70 p-8 dark:border-slate-800 dark:bg-slate-900/45">
          {file && <FileCard file={file} pageCount={pageCount} thumbnail={thumbnail} onRemove={clear} />}
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400">
              <Presentation className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">PDF to PowerPoint</h2>
              <p className="text-sm text-muted-foreground">High-fidelity PPTX output</p>
            </div>
          </div>

          <div className="space-y-3">
            <QualityCard icon={Search} title="Looks like your PDF" tone="green">
              Each page is rendered as a sharp slide image, so colors, photos, tables, and layout do not move around.
            </QualityCard>
            <QualityCard icon={Info} title="Text stays searchable">
              Selectable PDF text is placed invisibly over the slide, making words searchable and copyable without breaking the visual design.
            </QualityCard>
            <QualityCard icon={AlertCircle} title="About editing" tone="amber">
              This prioritizes faithful conversion. It is not a full design rebuild where every text box and shape becomes separately editable.
            </QualityCard>
          </div>

          {processing ? (
            <div className="mt-5">
              <ProcessingState progress={progress} label={processingLabel} onCancel={cancel} />
            </div>
          ) : (
            <button
              type="button"
              onClick={convertToPowerpoint}
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-red-600 px-6 py-5 text-lg font-bold text-white shadow-lg transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              Convert to PPTX
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
