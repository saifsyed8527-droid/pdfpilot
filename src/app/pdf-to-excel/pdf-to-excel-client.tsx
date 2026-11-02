"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  FileSpreadsheet,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PdfToolLanding,
  PdfToolResultLayout,
  PdfWorkspaceBar,
} from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { SourceFilePreview } from "@/components/tool/SourceFilePreview";
import { ResultState } from "@/components/tool/ResultState";
import { OcrLanguagePicker } from "@/components/tool/OcrLanguagePicker";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
import {
  createExcelFromPdfTables,
  type ExcelSheetLayout,
  type PdfTableMode,
  type PdfExcelResult,
} from "@/lib/engines/pdf-table-engine";
import { ocrLanguages } from "@/lib/engines/ocr-options";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { formatFileSize } from "@/lib/utils";

export function PdfToExcelClient(_props: {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}) {
  const [file, setFile] = useState<File | null>(null),
    [reading, setReading] = useState(false),
    [error, setError] = useState("");
  const [mode, setMode] = useState<PdfTableMode>("auto"),
    [languages, setLanguages] = useState<string[]>(["eng"]),
    [dpi, setDpi] = useState<150 | 300>(150),
    [pages, setPages] = useState("");
  const [layout, setLayout] = useState<ExcelSheetLayout>("multiple-sheets"),
    [result, setResult] = useState<PdfExcelResult | null>(null),
    [status, setStatus] = useState("");
  const input = useRef<HTMLInputElement>(null),
    generation = useRef(0),
    controller = useRef<AbortController | null>(null),
    downloaded = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask();
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [file, result]);
  const stop = () => {
    generation.current++;
    controller.current?.abort();
    cancel();
    setReading(false);
  };
  const reset = () => {
    stop();
    setFile(null);
    setResult(null);
    setError("");
    downloaded.current = false;
  };
  const choose = async (files: File[]) => {
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
    setError("");
    try {
      const bytes = await next.arrayBuffer();
      if (id !== generation.current) return;
      setFile(new File([bytes], next.name, { type: "application/pdf" }));
      setResult(null);
      downloaded.current = false;
    } catch {
      if (id === generation.current)
        setError("This file could not be read. Choose it again.");
    } finally {
      if (id === generation.current) setReading(false);
    }
  };
  const execute = () => {
    if (!file) return;
    try {
      if (mode !== "text") ocrLanguages(languages);
    } catch (cause) {
      setError((cause as Error).message);
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setError("");
    downloaded.current = false;
    void run(
      async (setProgress, cancelled) => {
        const output = await createExcelFromPdfTables(file, layout, undefined, {
          mode,
          languages,
          dpi,
          pages,
          signal: abort.signal,
          onProgress: setProgress,
          onStatus: (message) => {
            if (!cancelled()) setStatus(message);
          },
        });
        if (!cancelled() && !abort.signal.aborted) setResult(output);
      },
      {
        toolName: "pdf-to-excel",
        successMessage: "Your Excel workbook is ready to review",
        errorTitle: "Could not extract these tables",
        onError: (cause) => {
          const message =
            cause instanceof Error
              ? cause.message
              : "Choose a clearer PDF and retry.";
          setError(message);
          return message;
        },
      },
    );
  };
  const download = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);
  if (result) {
    const missing = result.pageReports.filter((page) => !page.tables),
      ocr = result.pageReports.filter((page) => page.ocr),
      weak = ocr.filter(
        (page) => (page.confidence ?? 100) < 70 || !!page.uncertainWords,
      );
    return (
      <PdfToolResultLayout toolSlug="pdf-to-excel">
        {!!missing.length && (
          <p
            role="alert"
            className="mb-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
          >
            No aligned table was detected on selected page
            {missing.length === 1 ? "" : "s"}{" "}
            {missing.map((page) => page.page).join(", ")}. Those pages are not
            included in the workbook. Check the PDF or try Free OCR with the
            correct languages.
          </p>
        )}
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={download}
          onStartOver={reset}
          autoDownloadedRef={downloaded}
          downloadLabel="Download Excel"
        />
        <p className="text-center text-sm">
          {result.totalRows} rows · {result.tables.length} table
          {result.tables.length === 1 ? "" : "s"} · {result.tablePageCount} PDF
          page{result.tablePageCount === 1 ? "" : "s"}
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Checked {result.pageReports.length} of {result.sourcePages} source
          pages.{" "}
          {ocr.length
            ? `Free OCR used on ${ocr.length} page${ocr.length === 1 ? "" : "s"}.`
            : "Selectable text used without OCR."}{" "}
          Cells are saved as text to preserve original values and identifiers.
        </p>
        {!!weak.length && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"
          >
            OCR found uncertain text on page{weak.length === 1 ? "" : "s"}{" "}
            {weak.map((page) => page.page).join(", ")}. Review every value
            against the original.
          </p>
        )}
        <details
          className="mt-5 rounded-xl border p-4"
          open={missing.length > 0}
        >
          <summary className="cursor-pointer font-semibold">
            Page conversion report
          </summary>
          <ul className="mt-3 max-h-52 space-y-2 overflow-auto text-sm">
            {result.pageReports.map((page) => (
              <li key={page.page}>
                Page {page.page}: {page.tables} table
                {page.tables === 1 ? "" : "s"}, {page.rows} rows ·{" "}
                {page.ocr
                  ? `OCR ${Math.round(page.confidence ?? 0)}%${page.uncertainWords ? ` · ${page.uncertainWords} uncertain words` : ""}`
                  : "selectable text"}
              </li>
            ))}
          </ul>
        </details>
        <details className="mt-4 rounded-xl border p-4">
          <summary className="cursor-pointer font-semibold">
            Preview the first table
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {result.tables[0].rows.slice(0, 8).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        dir="auto"
                        className="min-w-24 max-w-72 border p-2 align-top [overflow-wrap:anywhere]"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Showing up to eight rows. The downloaded workbook contains all
            detected rows.
          </p>
        </details>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setError("");
            }}
          >
            Back to options
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              downloadBlob(
                new Blob(
                  [
                    result.pageReports
                      .map(
                        (page) =>
                          `Page ${page.page}: ${page.tables} tables, ${page.rows} rows, ${page.ocr ? `OCR confidence ${Math.round(page.confidence ?? 0)}%, ${page.uncertainWords ?? 0} uncertain words` : "selectable text"}`,
                      )
                      .join("\n"),
                  ],
                  { type: "text/plain;charset=utf-8" },
                ),
                result.filename.replace(/\.xlsx$/, "-report.txt"),
              )
            }
          >
            Download page report
          </Button>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Table detection is approximate. Review numbers, merged cells,
          multi-line cells and reading order before using the workbook.
        </p>
      </PdfToolResultLayout>
    );
  }
  if (!file)
    return (
      <>
        <PdfToolLanding
          title="PDF to Excel"
          description="Extract editable tables from selectable PDFs and scans. Free OCR is included; choose one worksheet or a separate sheet for each table."
          buttonLabel="Select PDF file"
          dropLabel="or drop a PDF here"
          limitLabel="100MB · up to 200 selected pages"
          accept={{ "application/pdf": [".pdf"] }}
          multiple={false}
          icon={FileSpreadsheet}
          iconClass="text-amber-600"
          iconBackgroundClass="bg-amber-100 dark:bg-amber-950/40"
          accent="amber"
          onFilesSelected={(files) => {
            if (!reading) void choose(files);
          }}
        />
        {reading && (
          <div className="mx-auto max-w-md p-4">
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
            className="mx-auto mb-6 max-w-lg rounded-xl bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}
      </>
    );
  return (
    <div className="flex-1 bg-slate-50/70 dark:bg-slate-950/40">
      <input
        ref={input}
        type="file"
        hidden
        accept="application/pdf,.pdf"
        onChange={(event) => {
          void choose(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <PdfWorkspaceBar
        title="PDF to Excel"
        meta={
          <span dir="auto">
            {file.name} · {formatFileSize(file.size)}
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              disabled={processing || reading}
              onClick={() => input.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Replace PDF
            </Button>
            <Button
              variant="ghost"
              disabled={processing || reading}
              onClick={reset}
            >
              <X className="mr-2 h-4 w-4" />
              Remove
            </Button>
          </>
        }
      />
      <div className="mx-auto grid max-w-[1500px] gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:p-5">
        <section className="min-w-0 rounded-3xl border bg-white p-4 dark:bg-slate-900">
          <h2 className="mb-4 font-semibold">Original PDF</h2>
          <SourceFilePreview file={file} />
        </section>
        <aside className="flex min-h-0 flex-col rounded-3xl border bg-white p-5 dark:bg-slate-900 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:max-h-[900px]">
          <h2 className="mb-4 border-b pb-4 text-xl font-bold">
            Excel options
          </h2>
          <fieldset
            disabled={processing || reading}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1"
          >
            <div className="space-y-2">
              <p className="text-sm font-semibold">Text recognition</p>
              {(
                [
                  {
                    value: "auto",
                    label: "Auto · recommended",
                    description:
                      "Use selectable tables first; try free OCR on pages without a detected table.",
                  },
                  {
                    value: "ocr",
                    label: "Free OCR",
                    description: "Recognize every selected page as an image.",
                  },
                  {
                    value: "text",
                    label: "No OCR",
                    description:
                      "Use selectable text only; fastest for digital PDFs.",
                  },
                ] as const
              ).map((choice) => (
                <label
                  key={choice.value}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${mode === choice.value ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/20" : ""}`}
                >
                  <input
                    type="radio"
                    name="pdf-table-mode"
                    checked={mode === choice.value}
                    onChange={() => {
                      setMode(choice.value);
                      setError("");
                    }}
                    className="mt-1 accent-amber-600"
                  />
                  <span>
                    <strong className="text-sm">{choice.label}</strong>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {choice.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {mode !== "text" && (
              <>
                <OcrLanguagePicker
                  value={languages}
                  onChange={setLanguages}
                  disabled={processing || reading}
                />
                <label className="block text-sm font-semibold">
                  OCR resolution
                  <select
                    className="mt-2 h-11 w-full rounded-lg border bg-background px-3 font-normal"
                    value={dpi}
                    onChange={(event) =>
                      setDpi(Number(event.target.value) as 150 | 300)
                    }
                  >
                    <option value={150}>150 DPI · faster</option>
                    <option value={300}>300 DPI · small print</option>
                  </select>
                </label>
              </>
            )}
            <label className="block text-sm font-semibold">
              Pages
              <input
                value={pages}
                onChange={(event) => setPages(event.target.value)}
                placeholder="All pages, or 1-3, 5"
                className="mt-2 h-11 w-full rounded-lg border bg-background px-3 font-normal"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Up to 200 selected pages from a PDF of up to 2,000 pages.
              </span>
            </label>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-semibold">
                Excel layout
              </legend>
              {(
                [
                  {
                    value: "multiple-sheets",
                    label: "Multiple sheets",
                    description: "Separate worksheet for each detected table.",
                  },
                  {
                    value: "one-sheet",
                    label: "One sheet",
                    description:
                      "All detected tables together, with source page labels.",
                  },
                ] as const
              ).map((choice) => (
                <label
                  key={choice.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border p-3"
                >
                  <input
                    type="radio"
                    name="excel-layout"
                    checked={layout === choice.value}
                    onChange={() => setLayout(choice.value)}
                    className="mt-1 accent-amber-600"
                  />
                  <span>
                    <strong className="text-sm">{choice.label}</strong>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {choice.description}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950">
              Use clear, upright scans with aligned columns. OCR and table
              detection can make mistakes; review the workbook. Text outside
              detected tables is not included. Language data loads on the first
              OCR run.
            </p>
          </fieldset>
          {error && (
            <p
              role="alert"
              className="mt-3 max-h-28 shrink-0 overflow-auto rounded-xl bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          <div className="mt-4 shrink-0 border-t pt-4">
            {processing || reading ? (
              <ProcessingState
                progress={reading ? 0 : progress}
                label={
                  reading
                    ? "Reading selected file…"
                    : status || "Converting PDF…"
                }
                onCancel={stop}
              />
            ) : (
              <Button className="min-h-14 w-full text-base" onClick={execute}>
                Convert to Excel
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Files stay on your device
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
