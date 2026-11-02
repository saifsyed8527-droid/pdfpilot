"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  ArrowRight,
  FileText,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import {
  PdfToolLanding,
  PdfWorkspaceBar,
  PdfToolResultLayout,
} from "@/components/tool/PdfToolChrome";
import { SourceFilePreview } from "@/components/tool/SourceFilePreview";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { Button } from "@/components/ui/button";
import {
  repairPdf,
  REPAIR_LIMITS,
  type PdfRepairResult,
  type RepairMode,
} from "@/lib/engines/pdf-repair-engine";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { formatFileSize } from "@/lib/utils";
import { toast } from "sonner";

const accept = { "application/pdf": [".pdf"] };
export function RepairPdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<RepairMode>("structure");
  const [dpi, setDpi] = useState<150 | 300>(150);
  const [skipUnreadable, setSkipUnreadable] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<
    (PdfRepairResult & { filename: string }) | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null),
    generation = useRef(0),
    controller = useRef<AbortController | null>(null),
    autoDownloadRef = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [file, result]);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  const stop = () => {
    generation.current++;
    controller.current?.abort();
    cancel();
    setLoading(false);
    setMessage("");
  };
  const clear = () => {
    stop();
    setFile(null);
    setResult(null);
    setError("");
    autoDownloadRef.current = false;
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
      next.size > REPAIR_LIMITS.inputBytes
    ) {
      setError("Choose a non-empty PDF up to 100MB.");
      return;
    }
    const id = ++generation.current;
    controller.current?.abort();
    cancel();
    setLoading(true);
    setError("");
    try {
      const bytes = await next.arrayBuffer();
      if (id !== generation.current) return;
      setFile(new File([bytes], next.name, { type: "application/pdf" }));
      setResult(null);
      autoDownloadRef.current = false;
    } catch {
      if (id === generation.current)
        setError("The file could not be read. Choose it again.");
    } finally {
      if (id === generation.current) setLoading(false);
    }
  };
  const dropzone = useDropzone({
    accept,
    multiple: false,
    maxSize: REPAIR_LIMITS.inputBytes,
    noClick: true,
    noKeyboard: true,
    disabled: processing || loading,
    onDropAccepted: (files) => {
      void choose(files);
    },
    onDropRejected: () => setError("Choose one PDF up to 100MB."),
  });
  const execute = () => {
    if (!file) return;
    const abort = new AbortController();
    controller.current = abort;
    setError("");
    autoDownloadRef.current = false;
    void run(
      async (setProgress, cancelled) => {
        const output = await repairPdf(file, {
          mode,
          dpi,
          skipUnreadable,
          signal: abort.signal,
          onProgress: (value, label) => {
            if (!cancelled()) {
              setProgress(value);
              setMessage(label);
            }
          },
        });
        if (cancelled() || abort.signal.aborted) return;
        setResult({
          ...output,
          filename: `${safeBaseName(file.name)}_${output.mode === "structure" ? "repaired" : "recovered"}${output.pageCount < output.sourcePages ? "_partial" : ""}.pdf`,
        });
      },
      {
        toolName: "repair-pdf",
        successMessage: "Your PDF is ready to review",
        errorTitle: "This PDF needs another recovery method",
        onError: (cause) => {
          const value =
            cause instanceof Error
              ? cause.message
              : "Try another copy of this PDF.";
          setError(value);
          return value;
        },
      },
    );
  };
  const download = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);
  if (result) {
    const skipped = result.pages.filter((page) => page.status === "unreadable");
    const blank = result.pages.filter((page) => page.appearsBlank);
    return (
      <PdfToolResultLayout toolSlug="repair-pdf">
        {skipped.length > 0 && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-amber-50 p-4 font-medium text-amber-950"
          >
            Partial recovery: {result.pageCount} of {result.sourcePages} pages
            included. Missing source pages:{" "}
            {skipped.map((page) => page.sourcePage).join(", ")}.
          </p>
        )}
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={download}
          onStartOver={clear}
          autoDownloadedRef={autoDownloadRef}
          downloadLabel={
            skipped.length ? "Download partial PDF" : "Download PDF"
          }
        />
        <p className="text-center text-sm text-muted-foreground">
          {result.mode === "structure"
            ? "The PDF structure was re-saved and every page passed a rendering check. Text, form fields and document features were retained where readable."
            : "Visible page content was recovered as images. Text selection, editable forms, links, bookmarks and document attachments are not included."}
        </p>
        {blank.length > 0 && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"
          >
            Check source page{blank.length === 1 ? "" : "s"}{" "}
            {blank.map((page) => page.sourcePage).join(", ")}: the rendered page
            appears blank or very faint. Missing content cannot be recreated.
          </p>
        )}
        <details
          className="mt-5 rounded-xl border p-4"
          open={skipped.length > 0 || blank.length > 0}
        >
          <summary className="cursor-pointer font-medium">
            Page recovery report · {result.pageCount} of {result.sourcePages}
          </summary>
          <ol className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
            {result.pages.map((page) => (
              <li
                key={page.sourcePage}
                className={
                  page.status === "unreadable"
                    ? "text-red-700"
                    : "text-muted-foreground"
                }
              >
                Source page {page.sourcePage}:{" "}
                {page.status === "unreadable"
                  ? "not recovered"
                  : `output page ${page.outputPage} · ${page.status}`}
                {page.appearsBlank ? " · appears blank" : ""}
              </li>
            ))}
          </ol>
        </details>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setError("");
              autoDownloadRef.current = true;
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
                    result.pages
                      .map(
                        (page) =>
                          `Source page ${page.sourcePage}: ${page.outputPage ? `output page ${page.outputPage}` : "NOT RECOVERED"} · ${page.status}${page.appearsBlank ? " · appears blank" : ""}`,
                      )
                      .join("\n"),
                  ],
                  { type: "text/plain;charset=utf-8" },
                ),
                result.filename.replace(/\.pdf$/, "-report.txt"),
              )
            }
          >
            Download page report
          </Button>
        </div>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Review the full downloaded PDF. A rendering check cannot prove that
          every original detail survived damage.
        </p>
      </PdfToolResultLayout>
    );
  }
  if (!file)
    return (
      <>
        <PdfToolLanding
          title="Repair PDF"
          description="Fix a damaged PDF structure, or recover pages that can still be displayed. Your file stays on this device."
          buttonLabel="Select PDF file"
          dropLabel="or drop a PDF here"
          limitLabel="100MB · up to 200 pages"
          accept={accept}
          multiple={false}
          icon={RefreshCw}
          iconClass="text-orange-600"
          iconBackgroundClass="bg-orange-100 dark:bg-orange-950/40"
          accent="orange"
          onFilesSelected={(files) => {
            if (!loading) void choose(files);
          }}
        />
        {loading && (
          <div className="mx-auto w-full max-w-lg p-4">
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
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          void choose(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <PdfWorkspaceBar
        title="Repair PDF"
        meta={
          <span dir="auto">
            {file.name} · {formatFileSize(file.size)}
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              disabled={processing || loading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Replace PDF
            </Button>
            <Button
              variant="ghost"
              disabled={processing || loading}
              onClick={clear}
            >
              <X className="mr-2 h-4 w-4" />
              Remove
            </Button>
          </>
        }
      />
      <div className="mx-auto grid max-w-[1500px] gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-5">
        <section
          {...dropzone.getRootProps()}
          className={`min-w-0 rounded-3xl border bg-white p-4 dark:bg-slate-900 ${dropzone.isDragActive ? "ring-2 ring-orange-500" : ""}`}
          aria-label="Selected PDF preview. Drop a PDF to replace it."
        >
          <input {...dropzone.getInputProps()} />
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4" />
            Original document
          </h2>
          <SourceFilePreview file={file} />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            A damaged file may have no preview. You can still try either
            recovery method.
          </p>
        </section>
        <aside className="flex min-h-0 flex-col rounded-3xl border bg-white p-5 dark:bg-slate-900 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:max-h-[800px]">
          <h2 className="mb-4 border-b pb-4 text-xl font-bold">
            Repair options
          </h2>
          <fieldset
            disabled={processing || loading}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
          >
            <legend className="mb-2 text-sm font-semibold">
              Recovery method
            </legend>
            {(
              [
                {
                  value: "structure",
                  title: "Repair structure",
                  description:
                    "Rebuild the PDF structure while preserving readable text, forms, links and document details.",
                },
                {
                  value: "visible",
                  title: "Recover visible pages",
                  description:
                    "Create an image-only PDF from pages that can still be displayed. Use this when structure repair fails.",
                },
              ] as const
            ).map((choice) => (
              <label
                key={choice.value}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${mode === choice.value ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/20" : ""}`}
              >
                <input
                  type="radio"
                  name="repair-mode"
                  value={choice.value}
                  checked={mode === choice.value}
                  onChange={() => {
                    setMode(choice.value);
                    setError("");
                  }}
                  className="mt-1 accent-orange-600"
                />
                <span>
                  <strong className="block text-sm">{choice.title}</strong>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {choice.description}
                  </span>
                </span>
              </label>
            ))}
            {mode === "visible" && (
              <>
                <label className="block text-sm font-medium">
                  Recovery quality
                  <select
                    className="mt-2 h-11 w-full rounded-lg border bg-background px-3"
                    value={dpi}
                    onChange={(event) =>
                      setDpi(Number(event.target.value) as 150 | 300)
                    }
                  >
                    <option value={150}>150 DPI · smaller file</option>
                    <option value={300}>300 DPI · more detail</option>
                  </select>
                </label>
                <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 accent-orange-600"
                    checked={skipUnreadable}
                    onChange={(event) =>
                      setSkipUnreadable(event.target.checked)
                    }
                  />
                  <span>
                    Skip unreadable pages
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      I accept a partial PDF. The result will list every page
                      that could not be recovered.
                    </span>
                  </span>
                </label>
                <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  Visible recovery removes text selection, editable forms,
                  clickable links, bookmarks and document attachments. Page
                  appearance is flattened. Keep the original.
                </p>
              </>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              Missing content cannot be recreated. Password-protected, XFA and
              digitally signed PDFs are unsupported. Maximum 200 pages; image
              recovery uses up to 16 megapixels per page.
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
            {processing || loading ? (
              <ProcessingState
                progress={loading ? 0 : progress}
                label={
                  loading
                    ? "Reading selected file…"
                    : message || "Repairing PDF…"
                }
                onCancel={() => {
                  stop();
                  toast.info(
                    "Repair cancelled. Your file and options are kept.",
                  );
                }}
              />
            ) : (
              <Button className="min-h-14 w-full text-base" onClick={execute}>
                {mode === "structure" ? "Repair PDF" : "Recover visible pages"}
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
