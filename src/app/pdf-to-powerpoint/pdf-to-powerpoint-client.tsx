"use client";

import { useEffect, useRef, useState } from "react";
import { Presentation, X } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize } from "@/lib/utils";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  convertPdfToPowerpoint,
  pdfPowerpointError,
  type PdfPowerpointOptions,
  type PdfPowerpointResult,
} from "@/lib/engines/pdf-powerpoint-engine";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { SourceFilePreview } from "@/components/tool/SourceFilePreview";
import { OcrLanguagePicker } from "@/components/tool/OcrLanguagePicker";
import {
  PdfAddButton,
  PdfToolLanding,
  PdfToolResultLayout,
  PdfWorkspaceBar,
} from "@/components/tool/PdfToolChrome";

interface PdfToPowerpointClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}
const noteClass =
  "rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100";
const fieldClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950";

export function PdfToPowerpointClient(_props: PdfToPowerpointClientProps) {
  const [file, setFile] = useState<File | null>(null),
    [result, setResult] = useState<PdfPowerpointResult | null>(null);
  const [error, setError] = useState<string | null>(null),
    [reading, setReading] = useState(false);
  const [output, setOutput] =
      useState<PdfPowerpointOptions["output"]>("appearance"),
    [recognition, setRecognition] =
      useState<PdfPowerpointOptions["recognition"]>("text");
  const [layout, setLayout] =
      useState<PdfPowerpointOptions["layout"]>("source"),
    [dpi, setDpi] = useState<150 | 300>(150),
    [pages, setPages] = useState("");
  const [languages, setLanguages] = useState<string[]>(["eng"]),
    [status, setStatus] = useState("Creating slides…");
  const inputRef = useRef<HTMLInputElement | null>(null),
    generation = useRef(0),
    abortRef = useRef<AbortController | null>(null),
    autoDownloadRef = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask();
  const busy = reading || processing;
  const stop = () => {
    generation.current++;
    abortRef.current?.abort();
    cancel();
    setReading(false);
  };
  useEffect(
    () => () => {
      generation.current++;
      abortRef.current?.abort();
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
      setError("Choose a non-empty PDF up to 100MB.");
      return;
    }
    stop();
    const id = ++generation.current;
    setReading(true);
    setError(null);
    try {
      const data = await next.arrayBuffer();
      if (id !== generation.current) return;
      setFile(new File([data], next.name, { type: "application/pdf" }));
      setResult(null);
      autoDownloadRef.current = false;
    } catch {
      if (id === generation.current)
        setError("This file could not be read. Choose it again.");
    } finally {
      if (id === generation.current) setReading(false);
    }
  };
  const clear = () => {
    stop();
    setFile(null);
    setResult(null);
    setError(null);
    autoDownloadRef.current = false;
  };
  const convert = () => {
    if (!file || busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    run(
      async (setProgress, isCancelled) => {
        setResult(null);
        setError(null);
        autoDownloadRef.current = false;
        try {
          const converted = await convertPdfToPowerpoint(file, {
            output,
            recognition,
            layout,
            pages,
            dpi,
            languages,
            signal: controller.signal,
            onProgress: setProgress,
            onStatus: setStatus,
          });
          if (!isCancelled() && !controller.signal.aborted)
            setResult(converted);
        } finally {
          if (abortRef.current === controller) abortRef.current = null;
        }
      },
      {
        toolName: "pdf-to-powerpoint",
        successMessage: "Converted to PowerPoint successfully!",
        errorTitle: "Failed to convert to PowerPoint",
        onError: (cause) => {
          const message = pdfPowerpointError(cause);
          setError(message);
          return message;
        },
      },
    );
  };
  const download = () => {
    if (result) downloadBlob(result.blob, result.filename);
  };
  if (!file && !result)
    return (
      <>
        <PdfToolLanding
          title="Convert PDF to PowerPoint"
          description="Keep PDF page appearance or create editable text slides. Free OCR supports scans in 41 languages."
          buttonLabel="Select PDF file"
          dropLabel="or drop PDF here"
          limitLabel="PDF up to 100MB · up to 200 selected pages"
          accept={{ "application/pdf": [".pdf"] }}
          multiple={false}
          icon={Presentation}
          iconClass="text-orange-600"
          iconBackgroundClass="bg-orange-100 dark:bg-orange-950/30"
          accent="orange"
          onFilesSelected={chooseFile}
        />
        {reading && (
          <div className="mx-auto w-full max-w-xl p-4">
            <ProcessingState
              progress={0}
              label="Reading selected file…"
              onCancel={stop}
            />
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mx-auto max-w-xl rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}
      </>
    );
  if (result) {
    const noText = result.reports.filter((page) => !page.textBoxes),
      uncertain = result.reports.filter(
        (page) =>
          page.textBoxes &&
          page.ocr &&
          ((page.confidence ?? 100) < 70 || page.uncertainWords),
      ),
      images = result.reports.filter((page) => page.imageTextNotRecognized);
    return (
      <PdfToolResultLayout toolSlug="pdf-to-powerpoint">
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={download}
          downloadLabel="Download PowerPoint"
          onStartOver={clear}
          autoDownloadedRef={autoDownloadRef}
        />
        <div className="mx-auto max-w-2xl space-y-4 px-4">
          <p className={noteClass}>
            Created {result.reports.length} slide
            {result.reports.length === 1 ? "" : "s"} from {result.sourcePages}{" "}
            source page{result.sourcePages === 1 ? "" : "s"}.{" "}
            {result.output === "appearance"
              ? "Page images preserve the PDF appearance; recognized text is searchable. Editing that text layer does not change the visible image."
              : "Text is editable on a plain background. Pictures, original fonts, colors, tables and charts are not reconstructed."}
          </p>
          {!!noText.length && (
            <p role="status" className={noteClass}>
              No text {result.output === "appearance" ? "layer" : ""} on page
              {noText.length === 1 ? "" : "s"}{" "}
              {noText.map((page) => page.page).join(", ")}.{" "}
              {result.output === "appearance"
                ? "The original page image is kept. Use Auto or Free OCR to recognize scans."
                : "These slides remain blank. Check languages and scan quality, or keep page appearance."}
            </p>
          )}
          {!!images.length && (
            <p className={noteClass}>
              Image text on page{images.length === 1 ? "" : "s"}{" "}
              {images.map((page) => page.page).join(", ")} was not recognized.
              Choose Free OCR if a page contains both selectable text and a
              scan.
            </p>
          )}
          {!!uncertain.length && (
            <p className={noteClass}>
              Review uncertain OCR on page{uncertain.length === 1 ? "" : "s"}{" "}
              {uncertain.map((page) => page.page).join(", ")}, especially names,
              numbers and punctuation.
            </p>
          )}
          <details className="rounded-2xl border bg-white p-4 dark:bg-slate-900">
            <summary className="cursor-pointer font-semibold">
              Page conversion report
            </summary>
            <ul className="mt-3 space-y-2 text-sm">
              {result.reports.map((page) => (
                <li key={page.page}>
                  Page {page.page}: {page.textBoxes} text boxes ·{" "}
                  {page.ocr
                    ? `OCR ${Math.round(page.confidence ?? 0)}%${page.uncertainWords ? ` · ${page.uncertainWords} uncertain words` : ""}`
                    : "selectable text"}
                </li>
              ))}
            </ul>
          </details>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className="rounded-xl border px-4 py-3 text-sm font-semibold"
              onClick={() => {
                setResult(null);
                autoDownloadRef.current = false;
              }}
            >
              Back to options
            </button>
            <button
              type="button"
              className="rounded-xl border px-4 py-3 text-sm font-semibold"
              onClick={() =>
                downloadBlob(
                  new Blob(
                    [
                      result.reports
                        .map(
                          (page) =>
                            `PDF page ${page.page}: ${page.textBoxes} text boxes; ${page.ocr ? `OCR ${Math.round(page.confidence ?? 0)}%; ${page.uncertainWords ?? 0} uncertain words` : "native text"}${page.imageTextNotRecognized ? "; image text not recognized" : ""}`,
                        )
                        .join("\n"),
                    ],
                    { type: "text/plain;charset=utf-8" },
                  ),
                  result.filename.replace(/\.pptx$/, "_report.txt"),
                )
              }
            >
              Download page report
            </button>
          </div>
        </div>
      </PdfToolResultLayout>
    );
  }
  return (
    <div className="flex flex-1 flex-col bg-slate-50 dark:bg-slate-950">
      <PdfWorkspaceBar
        title="PDF to PowerPoint"
        meta={
          file ? `${file.name} · ${formatFileSize(file.size)}` : "Choose a PDF"
        }
        actions={
          <PdfAddButton cloud={{ accept: { "application/pdf": [".pdf"] }, multiple: false, onFilesSelected: chooseFile }}
            count={1}
            label="Replace PDF file"
            accent="orange"
            disabled={busy}
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
          void chooseFile(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <div className="container mx-auto grid max-w-[1500px] flex-1 items-start gap-6 px-4 py-8 lg:grid-cols-[1fr_420px]">
        <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-24">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Original PDF</h2>
            <button
              type="button"
              aria-label="Remove PDF"
              disabled={busy}
              onClick={clear}
              className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {file && <SourceFilePreview file={file} />}
        </section>
        <aside className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:pb-32">
          <div className="mb-5 flex items-center gap-3">
            <Presentation className="h-8 w-8 text-orange-600" />
            <div>
              <h2 className="text-2xl font-bold">PDF to PowerPoint</h2>
              <p className="text-sm text-muted-foreground">
                Choose what you want to edit
              </p>
            </div>
          </div>
          <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
            <div
              role="radiogroup"
              aria-label="Slide content"
              className="space-y-3"
            >
              {(
                [
                  {
                    value: "appearance",
                    title: "Keep page appearance",
                    description:
                      "Page images with searchable text. Keeps pictures and layout.",
                  },
                  {
                    value: "editable",
                    title: "Editable text",
                    description:
                      "Real text boxes on a plain background. Pictures and original styling are omitted.",
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${output === option.value ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30" : "border-slate-200 dark:border-slate-700"}`}
                >
                  <input
                    type="radio"
                    name="slide-content"
                    value={option.value}
                    checked={output === option.value}
                    onChange={() => {
                      setOutput(option.value);
                      setError(null);
                    }}
                    className="mt-1 accent-orange-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      {option.title}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <label className="block text-sm font-semibold">
              Text recognition
              <select
                aria-label="Text recognition"
                className={fieldClass}
                value={recognition}
                onChange={(event) => {
                  setRecognition(event.target.value as typeof recognition);
                  setError(null);
                }}
              >
                <option value="text">No OCR · selectable text</option>
                <option value="auto">
                  Auto · recognize pages without text
                </option>
                <option value="ocr">
                  Free OCR · recognize every selected page
                </option>
              </select>
            </label>
            {recognition !== "text" && (
              <>
                <OcrLanguagePicker
                  value={languages}
                  onChange={setLanguages}
                  disabled={busy}
                  primary
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Choose the main document language. Auto skips scans on pages
                  that already have selectable text; Free OCR also reads
                  captioned scans. Use clear upright scans and review the
                  output.
                </p>
              </>
            )}
            <label className="block text-sm font-semibold">
              Slide size
              <select
                aria-label="Slide size"
                className={fieldClass}
                value={layout}
                onChange={(event) =>
                  setLayout(event.target.value as typeof layout)
                }
              >
                <option value="source">Match first selected page</option>
                <option value="wide">Widescreen · 16:9</option>
                <option value="standard">Standard · 4:3</option>
              </select>
              <span className="mt-2 block text-xs font-normal text-muted-foreground">
                All slides share this size. Different page sizes fit inside it
                without stretching.
              </span>
            </label>
            <label className="block text-sm font-semibold">
              Resolution
              <select
                aria-label="Resolution"
                className={fieldClass}
                value={dpi}
                onChange={(event) =>
                  setDpi(Number(event.target.value) as 150 | 300)
                }
              >
                <option value={150}>150 DPI · faster</option>
                <option value={300}>300 DPI · small print</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Pages
              <input
                aria-label="Pages"
                placeholder="All pages, e.g. 1-3, 5"
                className={fieldClass}
                value={pages}
                onChange={(event) => {
                  setPages(event.target.value);
                  setError(null);
                }}
              />
              <span className="mt-2 block text-xs font-normal text-muted-foreground">
                Up to 200 selected pages from a PDF of up to 2,000 pages.
              </span>
            </label>
          </fieldset>
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
            >
              {error}
            </p>
          )}
          <div className="mt-6 lg:fixed lg:bottom-0 lg:right-0 lg:z-20 lg:mt-0 lg:w-[452px] lg:border-t lg:bg-white/95 lg:p-4 lg:backdrop-blur dark:lg:bg-slate-950/95">
            {busy ? (
              <ProcessingState
                progress={progress}
                label={reading ? "Reading selected file…" : status}
                onCancel={stop}
              />
            ) : (
              <button
                type="button"
                onClick={convert}
                className="flex w-full items-center justify-center rounded-2xl bg-orange-600 px-6 py-5 text-lg font-bold text-white shadow-lg hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              >
                Convert to PPTX
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
