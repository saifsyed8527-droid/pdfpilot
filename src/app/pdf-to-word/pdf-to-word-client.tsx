"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Info, ScanText, X } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { cn, formatFileSize } from "@/lib/utils";
import { useProcessingTask } from "@/lib/use-processing-task";
import { extractPdfText, hasNoExtractableText, type ExtractedPage } from "@/lib/pdf-text-extraction";
import { createOcrWorker } from "@/lib/engines/ocr-engine";
import { renderFirstPageThumbnailWithInfo, renderPdfPages } from "@/lib/engines/pdf-render-engine";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { PdfAddButton, PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";

type ConversionMode = "auto" | "ocr" | "text";

interface PdfToWordClientProps {
  faqs: FaqInput[];
}

interface WordResult {
  blob: Blob;
  filename: string;
  usedOcr: boolean;
}

function outputName(file: File, extension: string) {
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "converted";
  return `${base}.${extension}`;
}

function splitOcrText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function createWordFromSelectableText(pages: ExtractedPage[]) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = await import("docx");
  const headingLevel = {
    heading1: HeadingLevel.HEADING_1,
    heading2: HeadingLevel.HEADING_2,
    body: undefined,
  } as const;

  const children: InstanceType<typeof Paragraph>[] = [];
  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    page.paragraphs.forEach((text, i) => {
      children.push(
        new Paragraph({
          children: [new TextRun(text)],
          heading: headingLevel[page.paragraphStyles[i]],
          spacing: { after: 180 },
        })
      );
    });
  });

  const doc = new Document({
    sections: [{ children: children.length ? children : [new Paragraph("No readable text found.")] }],
  });
  return Packer.toBlob(doc);
}

async function createWordFromOcrPages(pageTexts: string[][]) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = await import("docx");
  const children: InstanceType<typeof Paragraph>[] = [];

  pageTexts.forEach((lines, pageIndex) => {
    if (pageIndex > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    if (pageTexts.length > 1) {
      children.push(new Paragraph({ text: `Page ${pageIndex + 1}`, heading: HeadingLevel.HEADING_2, spacing: { after: 180 } }));
    }
    if (lines.length) {
      lines.forEach((line) => {
        children.push(new Paragraph({ children: [new TextRun(line)], spacing: { after: 140 } }));
      });
    } else {
      children.push(new Paragraph({ children: [new TextRun("No text recognized on this page.")] }));
    }
  });

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
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

function ModeOption({
  id,
  value,
  title,
  description,
  badge,
  onChange,
}: {
  id: ConversionMode;
  value: ConversionMode;
  title: string;
  description: string;
  badge?: string;
  onChange: (mode: ConversionMode) => void;
}) {
  const selected = id === value;
  return (
    <button
      type="button"
      onClick={() => onChange(id)}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition hover:border-red-300 hover:bg-red-50/60 dark:hover:bg-red-950/20",
        selected ? "border-red-500 bg-red-50 shadow-sm dark:bg-red-950/25" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">{title}</span>
            {badge && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{badge}</span>}
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        <span className={cn("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300")}>
          {selected && <CheckCircle2 className="h-4 w-4" aria-hidden />}
        </span>
      </div>
    </button>
  );
}

export function PdfToWordClient({ faqs: _faqs }: PdfToWordClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null | undefined>(undefined);
  const [pageCount, setPageCount] = useState<number | undefined>(undefined);
  const [mode, setMode] = useState<ConversionMode>("auto");
  const [result, setResult] = useState<WordResult | null>(null);
  const [processingLabel, setProcessingLabel] = useState("Converting PDF to Word…");
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

  const convertToWord = () => {
    if (!file) return;
    run(
      async (setProgress, isCancelled) => {
        setResult(null);
        autoDownloadRef.current = false;
        let usedOcr = mode === "ocr";

        if (mode !== "ocr") {
          setProcessingLabel("Reading selectable text…");
          const pages = await extractPdfText(file);
          setProgress(24);
          if (isCancelled()) return;

          if (!hasNoExtractableText(pages)) {
            const blob = await createWordFromSelectableText(pages);
            setProgress(100);
            setResult({ blob, filename: outputName(file, "docx"), usedOcr: false });
            return;
          }

          if (mode === "text") {
            throw new Error("This PDF looks scanned. Choose Auto or Free OCR to convert it into editable Word text.");
          }
          usedOcr = true;
        }

        setProcessingLabel("Running free OCR on scanned pages…");
        const renderedPages = await renderPdfPages(file, {
          scale: 2.6,
          onProgress: (page, total) => setProgress(8 + (page / total) * 22),
        });
        if (isCancelled()) return;

        const worker = await createOcrWorker();
        const pageTexts: string[][] = [];
        try {
          for (let i = 0; i < renderedPages.length; i++) {
            if (isCancelled()) return;
            setProcessingLabel(`Recognizing text on page ${i + 1} of ${renderedPages.length}…`);
            const pageBase = 30 + (i / renderedPages.length) * 58;
            const pageSpan = 58 / renderedPages.length;
            const ocr = await worker.recognize(renderedPages[i].canvas, (ocrProgress) => {
              setProgress(pageBase + (ocrProgress / 100) * pageSpan);
            });
            pageTexts.push(splitOcrText(ocr.text));
          }
        } finally {
          await worker.terminate();
        }

        const blob = await createWordFromOcrPages(pageTexts);
        setProgress(100);
        setResult({ blob, filename: outputName(file, "docx"), usedOcr });
      },
      {
        successMessage: "Converted to Word successfully!",
        toolName: "pdf-to-word",
        errorTitle: "Failed to convert to Word",
        onError: (error) => {
          console.error("Error converting PDF to Word:", error);
          return error instanceof Error ? error.message : "Please try again with a valid PDF file.";
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
        title="PDF to Word Converter"
        description="Convert selectable PDFs and scanned PDFs into editable Word documents. Free OCR is included for image-only pages."
        buttonLabel="Select PDF file"
        dropLabel="or drop PDF here"
        limitLabel="PDF up to 100MB"
        accept={{ "application/pdf": [".pdf"] }}
        multiple={false}
        icon={FileText}
        iconClass="text-red-600"
        iconBackgroundClass="bg-red-100 dark:bg-red-950/30"
        accent="orange"
        onFilesSelected={chooseFile}
      />
    );
  }

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="pdf-to-word">
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={downloadResult}
          downloadLabel="Download Word"
          onStartOver={clear}
          autoDownloadedRef={autoDownloadRef}
        />
        {result.usedOcr && (
          <div className="mx-auto -mt-2 max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            OCR was used to recognize scanned text. Please quickly review the Word file because OCR accuracy depends on scan quality.
          </div>
        )}
      </PdfToolResultLayout>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-slate-50 dark:bg-slate-950">
      <PdfWorkspaceBar
        title="PDF to Word"
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
              <ScanText className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">PDF to Word</h2>
              <p className="text-sm text-muted-foreground">Editable DOCX output</p>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
            <div className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>Auto mode uses selectable PDF text when available and switches to free OCR when the PDF is scanned.</p>
            </div>
          </div>

          <div className="space-y-3">
            <ModeOption id="auto" value={mode} title="Auto" badge="Recommended" description="Best choice for normal and scanned PDFs. Uses OCR only when needed." onChange={setMode} />
            <ModeOption id="ocr" value={mode} title="Free OCR" badge="Free" description="Force OCR for scanned/image-only PDFs. Slower, but works when text is not selectable." onChange={setMode} />
            <ModeOption id="text" value={mode} title="No OCR" description="Fast conversion for PDFs that already have selectable text." onChange={setMode} />
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>Word output extracts text and readable structure. Complex layouts, exact fonts, and tables may still need light review after conversion.</p>
            </div>
          </div>

          {processing ? (
            <div className="mt-5">
              <ProcessingState progress={progress} label={processingLabel} onCancel={cancel} />
            </div>
          ) : (
            <button
              type="button"
              onClick={convertToWord}
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-red-600 px-6 py-5 text-lg font-bold text-white shadow-lg transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              Convert to WORD
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
