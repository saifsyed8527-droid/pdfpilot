"use client";
import { useWorkspaceText } from "@/components/i18n/WorkspaceText";


import { UiText } from "@/components/i18n/UiText";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Info,
  ScanText,
} from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { cn, formatFileSize } from "@/lib/utils";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  convertPdfToWord,
  type PdfWordMode,
  type PdfWordResult,
} from "@/lib/engines/pdf-word-engine";
import { SourceFilePreview } from "@/components/tool/SourceFilePreview";
import { OcrLanguagePicker } from "@/components/tool/OcrLanguagePicker";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { pdfDocumentInputError } from "@/lib/engines/conversion-input-errors";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import {
  PdfAddButton,
  PdfToolLanding,
  PdfToolResultLayout,
  PdfWorkspaceBar,
} from "@/components/tool/PdfToolChrome";

type ConversionMode = PdfWordMode;

interface PdfToWordClientProps {
  faqs: FaqInput[];
}

interface WordResult extends PdfWordResult {
  filename: string;
}

function ModeOption({
  id,
  value,
  title,
  description,
  badge,
  onChange,
  disabled,
}: {
  id: ConversionMode;
  value: ConversionMode;
  title: string;
  description: string;
  badge?: string;
  onChange: (mode: ConversionMode) => void;
  disabled?: boolean;
}) {
  const selected = id === value;
  return (
    <label
      className={cn(
        "block w-full cursor-pointer rounded-2xl border p-4 text-left transition focus-within:ring-2 focus-within:ring-red-500 hover:border-red-300 hover:bg-red-50/60 dark:hover:bg-red-950/20",
        selected
          ? "border-red-500 bg-red-50 shadow-sm dark:bg-red-950/25"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
      )}
    >
      <input
        type="radio"
        name="pdf-word-mode"
        value={id}
        checked={selected}
        disabled={disabled}
        onChange={() => onChange(id)}
        className="sr-only"
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">
              {title}
            </span>
            {badge && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
            {description}
          </p>
        </div>
        <span
          className={cn(
            "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
            selected
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-300",
          )}
        >
          {selected && <CheckCircle2 className="h-4 w-4" aria-hidden />}
        </span>
      </div>
    </label>
  );
}

export function PdfToWordClient({ faqs: _faqs }: PdfToWordClientProps) {
  const __copy = useWorkspaceText();
  const [file, setFile] = useState<File | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [languages, setLanguages] = useState<string[]>(["eng"]);
  const [pages, setPages] = useState("");
  const [dpi, setDpi] = useState<150 | 300>(150);
  const [reading, setReading] = useState(false);
  const generation = useRef(0);
  const [mode, setMode] = useState<ConversionMode>("auto");
  const [result, setResult] = useState<WordResult | null>(null);
  const [processingLabel, setProcessingLabel] = useState(
    "Converting PDF to Word…",
  );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoDownloadRef = useRef(false);
  const conversionAbortRef = useRef<AbortController | null>(null);
  const { processing, progress, run, cancel } = useProcessingTask();

  const cancelConversion = () => {
    generation.current++;
    conversionAbortRef.current?.abort();
    cancel();
    setReading(false);
  };

  useEffect(
    () => () => {
      generation.current++;
      conversionAbortRef.current?.abort();
      cancel();
    },
    [cancel],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [file, result]);

  const chooseFile = async (files: File[]) => {
    const next = files[0];
    if (!next) return;
    if (
      !(
        next.type === "application/pdf" ||
        next.name.toLowerCase().endsWith(".pdf")
      ) ||
      !next.size ||
      next.size > 100 * 1024 * 1024
    ) {
      setConversionError("Choose a non-empty PDF up to 100MB.");
      return;
    }
    cancelConversion();
    const id = ++generation.current;
    setReading(true);
    setConversionError(null);
    try {
      const bytes = await next.arrayBuffer();
      if (id !== generation.current) return;
      setFile(new File([bytes], next.name, { type: "application/pdf" }));
      setResult(null);
      autoDownloadRef.current = false;
    } catch {
      if (id === generation.current)
        setConversionError("This file could not be read. Choose it again.");
    } finally {
      if (id === generation.current) setReading(false);
    }
  };

  const clear = () => {
    cancelConversion();
    setFile(null);
    setResult(null);
    setConversionError(null);
    autoDownloadRef.current = false;
  };

  const convertToWord = () => {
    if (!file || processing || reading) return;
    conversionAbortRef.current?.abort();
    const controller = new AbortController();
    conversionAbortRef.current = controller;
    run(
      async (setProgress, isCancelled) => {
        setResult(null);
        setConversionError(null);
        autoDownloadRef.current = false;
        try {
          const converted = await convertPdfToWord(file, {
            mode,
            languages,
            pages,
            dpi,
            isCancelled,
            signal: controller.signal,
            onProgress: setProgress,
            onStatus: setProcessingLabel,
          });
          if (!converted || isCancelled() || controller.signal.aborted) return;
          setResult({
            ...converted,
            filename: `${safeBaseName(file.name)}.docx`,
          });
        } finally {
          // An older cancelled task must not detach a newer attempt's controller.
          if (conversionAbortRef.current === controller)
            conversionAbortRef.current = null;
        }
      },
      {
        successMessage: "Converted to Word successfully!",
        toolName: "pdf-to-word",
        errorTitle: "Failed to convert to Word",
        onError: (error) => {
          const message = pdfDocumentInputError(error);
          setConversionError(message);
          return message;
        },
      },
    );
  };

  const downloadResult = () => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  };

  if (!file && !result) {
    return (
      <>
        <PdfToolLanding
          title={__copy("PDF to Word Converter")}
          description={__copy("Convert selectable PDFs and scans into editable Word text. Free OCR supports 41 document languages.")}
          buttonLabel={__copy("Select PDF file")}
          dropLabel={__copy("or drop PDF here")}
          limitLabel={__copy("PDF up to 100MB · up to 200 selected pages")}
          accept={{ "application/pdf": [".pdf"] }}
          multiple={false}
          icon={FileText}
          iconClass="text-red-600"
          iconBackgroundClass="bg-red-100 dark:bg-red-950/30"
          accent="orange"
          onFilesSelected={chooseFile}
        />
        {reading && (
          <ProcessingState
            progress={0}
            label={__copy("Reading selected file…")}
            onCancel={cancelConversion}
          />
        )}
        {conversionError && (
          <p
            role="alert"
            className="mx-auto mb-6 max-w-lg rounded-xl bg-red-50 p-4 text-sm text-red-800"
          >
            {conversionError}
          </p>
        )}
      </>
    );
  }

  if (result) {
    const imagePages = result.pageReports.filter(
      (page) => page.imagesNotTranscribed,
    );
    const uncertain = result.pageReports.filter(
      (page) =>
        page.characters > 0 &&
        page.ocr &&
        ((page.confidence ?? 100) < 70 || !!page.uncertainWords),
    );
    return (
      <PdfToolResultLayout toolSlug="pdf-to-word">
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={downloadResult}
          downloadLabel={__copy("Download Word")}
          onStartOver={clear}
          autoDownloadedRef={autoDownloadRef}
        />
        {result.unrecognizedPages.length > 0 && (
          <p
            role="status"
            className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            {""}<UiText text={"No text was recognized on page"} />{" "}{result.unrecognizedPages.length === 1 ? "" : "s"}{" "}
            {result.unrecognizedPages.join(", ")}{""}<UiText text={". These pages remain blank in Word. Check the source and try clearer scans if they contain text."} />{" "}</p>
        )}
        {result.usedOcr && (
          <div className="mx-auto -mt-2 max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            {""}<UiText text={"OCR was used to recognize scanned text. Please quickly review the Word file because OCR accuracy depends on scan quality."} />{" "}</div>
        )}
        <p className="mt-4 text-center text-sm">
          {""}<UiText text={"Converted"} />{" "}{result.processedPages.length} {""}<UiText text={"of"} />{" "}{result.sourcePages}{" "}
          {""}<UiText text={"source pages."} />{" "}</p>
        {!!imagePages.length && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
          >
            {""}<UiText text={"Images on page"} />{""}{imagePages.length === 1 ? "" : "s"}{" "}
            {imagePages.map((page) => page.page).join(", ")} {""}<UiText text={"were not transcribed. If they contain scanned text, use Free OCR. Pictures are not included in this text-based Word output."} />{" "}</p>
        )}
        {!!uncertain.length && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
          >
            {""}<UiText text={"OCR found uncertain text on page"} />{""}{uncertain.length === 1 ? "" : "s"}{" "}
            {uncertain.map((page) => page.page).join(", ")}{""}<UiText text={". Compare names, numbers and punctuation with the original."} />{" "}</p>
        )}
        <details
          className="mt-5 rounded-xl border p-4"
          open={!!result.unrecognizedPages.length || !!imagePages.length}
        >
          <summary className="cursor-pointer font-semibold">
            {""}<UiText text={"Page conversion report"} />{" "}</summary>
          <ul className="mt-3 max-h-52 space-y-2 overflow-auto text-sm">
            {result.pageReports.map((page) => (
              <li key={page.page}>
                {""}<UiText text={"Page"} />{" "}{page.page}: {page.characters} {""}<UiText text={"characters ·"} />{""}{" "}
                {page.ocr ? <UiText text={"OCR {0}%{1}"} values={[Math.round(page.confidence ?? 0), page.uncertainWords ? ` · ${page.uncertainWords} uncertain words` : ""]} /> : <UiText text={"selectable text"} />}
                {page.imagesNotTranscribed ? <UiText text={" · image text not transcribed"} /> : ""}
              </li>
            ))}
          </ul>
        </details>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            className="rounded-lg border px-4 py-3 text-sm"
            onClick={() => {
              setResult(null);
              setConversionError(null);
            }}
          >
            {""}<UiText text={"Back to options"} />{" "}</button>
          <button
            className="rounded-lg border px-4 py-3 text-sm"
            onClick={() =>
              downloadBlob(
                new Blob(
                  [
                    result.pageReports
                      .map(
                        (page) =>
                          `Page ${page.page}: ${page.characters} characters, ${page.ocr ? `OCR confidence ${Math.round(page.confidence ?? 0)}%, ${page.uncertainWords ?? 0} uncertain words` : "selectable text"}${page.imagesNotTranscribed ? "; image text not transcribed" : ""}`,
                      )
                      .join("\n"),
                  ],
                  { type: "text/plain;charset=utf-8" },
                ),
                result.filename.replace(/\.docx$/, "-report.txt"),
              )
            }
          >
            {""}<UiText text={"Download page report"} />{" "}</button>
        </div>
      </PdfToolResultLayout>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-slate-50 dark:bg-slate-950">
      <PdfWorkspaceBar
        title={__copy("PDF to Word")}
        meta={
          file ? `${file.name} · ${formatFileSize(file.size)}` : "Choose a PDF"
        }
        actions={
          <PdfAddButton cloud={{ accept: { "application/pdf": [".pdf"] }, multiple: false, onFilesSelected: chooseFile }}
            count={file ? 1 : undefined}
            label={__copy("Replace PDF file")}
            accent="orange"
            disabled={processing || reading}
            onClick={() => inputRef.current?.click()}
          />
        }
      />
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          void chooseFile(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />

      <div className="container mx-auto grid max-w-[1500px] flex-1 gap-6 px-4 py-8 lg:grid-cols-[1fr_420px]">
        <section className="min-w-0 rounded-3xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/45">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{""}<UiText text={"Original PDF"} />{""}</h2>
            <button
              className="rounded-lg px-3 py-2 text-sm text-red-600"
              disabled={processing || reading}
              onClick={clear}
            >
              {""}<UiText text={"Remove PDF"} />{" "}</button>
          </div>
          {file && <SourceFilePreview file={file} />}
        </section>

        <aside className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:max-h-[900px]">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400">
              <ScanText className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                <UiText text="PDF to Word" />
              </h2>
              <p className="text-sm text-muted-foreground">
                {""}<UiText text={"Editable DOCX output"} />{" "}</p>
            </div>
          </div>

          <fieldset
            disabled={processing || reading}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1"
          >
            <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
              <div className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  {""}<UiText text={"Auto keeps selectable text and uses free OCR for pages with no selectable text. Choose Free OCR when a scan also contains a selectable caption or footer."} />{" "}</p>
              </div>
            </div>

            <div
              role="radiogroup"
              aria-label={__copy("Text recognition")}
              className="space-y-3"
            >
              <ModeOption
                id="auto"
                value={mode}
                title={__copy("Auto")}
                badge="Recommended"
                description={__copy("Best choice for normal and scanned PDFs. Uses OCR only when needed.")}
                onChange={setMode}
                disabled={processing || reading}
              />
              <ModeOption
                id="ocr"
                value={mode}
                title={__copy("Free OCR")}
                badge="Free"
                description={__copy("Force OCR for scanned/image-only PDFs. Slower, but works when text is not selectable.")}
                onChange={setMode}
                disabled={processing || reading}
              />
              <ModeOption
                id="text"
                value={mode}
                title={__copy("No OCR")}
                description={__copy("Fast conversion for PDFs that already have selectable text.")}
                onChange={setMode}
                disabled={processing || reading}
              />
            </div>

            {mode !== "text" && (
              <>
                <OcrLanguagePicker
                  primary
                  value={languages}
                  onChange={setLanguages}
                  disabled={processing || reading}
                />
                <label className="block text-sm font-semibold">
                  {""}<UiText text={"OCR resolution"} />{" "}<select
                    aria-label={__copy("OCR resolution")}
                    className="mt-2 h-11 w-full rounded-lg border bg-background px-3 font-normal"
                    value={dpi}
                    onChange={(event) =>
                      setDpi(Number(event.target.value) as 150 | 300)
                    }
                  >
                    <option value={150}>{""}<UiText text={"150 DPI · faster"} />{""}</option>
                    <option value={300}>{""}<UiText text={"300 DPI · small print"} />{""}</option>
                  </select>
                </label>
              </>
            )}
            <label className="block text-sm font-semibold">
              {""}<UiText text={"Pages"} />{" "}<input
                aria-label={__copy("Pages")}
                className="mt-2 h-11 w-full rounded-lg border bg-background px-3 font-normal"
                placeholder={__copy("All pages, or 1-3, 5")}
                value={pages}
                onChange={(event) => setPages(event.target.value)}
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {""}<UiText text={"Up to 200 selected pages from a PDF of up to 2,000 pages."} />{" "}</span>
            </label>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  {""}<UiText text={"Word output contains editable text, basic headings and page breaks. Pictures, tables, exact fonts and complex layouts are not reconstructed. Use upright scans and review every OCR value."} />{" "}</p>
              </div>
            </div>
          </fieldset>
          {conversionError && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
            >
              {conversionError}
            </p>
          )}

          {processing || reading ? (
            <div className="mt-5">
              <ProcessingState
                progress={reading ? 0 : progress}
                label={reading ? "Reading selected file…" : processingLabel}
                onCancel={cancelConversion}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={convertToWord}
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-red-600 px-6 py-5 text-lg font-bold text-white shadow-lg transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              {""}<UiText text={"Convert to WORD"} />{" "}</button>
          )}
        </aside>
      </div>
    </div>
  );
}
