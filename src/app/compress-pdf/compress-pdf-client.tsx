"use client";

import { UiText } from "@/components/i18n/UiText";
import { useEffect, useRef, useState } from "react";
import {
  X,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowDownAZ,
  ArrowUpZA,
  FileText,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize, cn } from "@/lib/utils";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  optimizePdf,
  optimizationPreview,
  type OptimizeOptions,
  type OptimizeResult,
} from "@/lib/engines/pdf-optimize-engine";
import { passwordZip } from "@/lib/engines/pdf-password-engine";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { getCategoryStyle } from "@/lib/category-colors";
import { getTool } from "@/lib/tools";
import type { ToolLandingCopy } from "@/lib/i18n/core-content";
import { ProcessingState } from "@/components/tool/ProcessingState";
import {
  PdfAddButton,
  PdfToolLanding,
  PdfToolResultLayout,
  PdfWorkspaceBar,
} from "@/components/tool/PdfToolChrome";

const tool = getTool("/compress-pdf")!;
const QUALITY_OPTIONS = [
  {
    id: "low",
    label: "Extreme Compression",
    description: "Smaller images, more quality loss",
  },
  {
    id: "medium",
    label: "Recommended Compression",
    description: "Balanced image quality and file size",
  },
  {
    id: "high",
    label: "Less Compression",
    description: "Higher image quality, larger file size",
  },
] as const;
type Entry = {
  id: string;
  file: File;
  rotation: 0 | 90 | 180 | 270;
  thumbnail?: string;
  pageCount?: number;
  previewError?: string;
  error?: string;
  result?: OptimizeResult;
};
type Result = {
  entries: Entry[];
  blob: Blob;
  name: string;
  unfinished: number;
};
const filename = (file: File) => `${safeBaseName(file.name)}_compressed.pdf`;
const DEFAULT_LANDING_COPY: ToolLandingCopy = {
  title: "Compress PDF",
  description:
    "Make PDFs smaller while keeping text, links and forms. Choose image quality or lossless optimization and download privately in your browser.",
  buttonLabel: "Select PDF files",
  dropLabel: "or drag and drop PDF files here",
  limitLabel: "100MB max per PDF",
};

function FileCard({
  entry,
  index,
  disabled,
  onRotate,
  onRemove,
}: {
  entry: Entry;
  index: number;
  disabled: boolean;
  onRotate: () => void;
  onRemove: () => void;
}) {
  return (
    <article
      className={cn(
        "group relative flex min-h-[302px] w-[234px] max-w-full flex-col rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900",
        entry.error && "border-red-400",
      )}
    >
      <span className="absolute left-2 top-2 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[11px] font-semibold text-white">
        {index + 1}
      </span>
      <div className="relative flex h-[236px] items-center justify-center overflow-hidden rounded-xl bg-muted">
        {entry.thumbnail ? (
          <img
            src={entry.thumbnail}
            alt={`Preview of ${entry.file.name}`}
            className="h-full w-full object-contain"
            style={{
              transform: `rotate(${entry.rotation}deg) scale(${entry.rotation % 180 ? 0.8 : 1})`,
            }}
          />
        ) : (
          <FileText
            className={cn(
              "h-10 w-10",
              entry.previewError
                ? "text-red-500"
                : "animate-pulse text-muted-foreground",
            )}
          />
        )}
        <div className="absolute right-1.5 top-1.5 flex gap-1">
          <button
            type="button"
            onClick={onRotate}
            disabled={disabled}
            aria-label={`Rotate ${entry.file.name} clockwise`}
            title="Rotate every page clockwise"
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-white/95 text-slate-900 shadow disabled:opacity-40"
          >
            <RotateCw size={17} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remove ${entry.file.name}`}
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-white/95 text-red-600 shadow disabled:opacity-40"
          >
            <X size={17} />
          </button>
        </div>
        {!!entry.rotation && (
          <span className="absolute bottom-2 rounded bg-slate-950 px-2 py-1 text-xs text-white">
            +{entry.rotation}° · every page
          </span>
        )}
      </div>
      <div className="mt-2 min-w-0 border-t pt-2">
        <p className="truncate text-sm font-medium" title={entry.file.name}>
          {entry.file.name}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {entry.pageCount
            ? `${entry.pageCount} page${entry.pageCount === 1 ? "" : "s"} · `
            : ""}
          {formatFileSize(entry.file.size)}
        </p>
        {entry.previewError && !entry.error && (
          <p className="mt-2 text-xs text-muted-foreground">
            Preview unavailable. Compression will check the file.
          </p>
        )}
        {entry.error && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {entry.error}
          </p>
        )}
        {entry.result && (
          <p className="mt-2 text-xs text-green-700 dark:text-green-400">
            {entry.result.unchanged
              ? "Original kept · size unchanged"
              : `Ready · ${formatFileSize(entry.result.blob.size)}`}
          </p>
        )}
      </div>
    </article>
  );
}

export function CompressPdfClient({
  landingCopy = DEFAULT_LANDING_COPY,
}: {
  landingCopy?: ToolLandingCopy;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [quality, setQuality] = useState<OptimizeOptions["quality"]>("medium");
  const [mode, setMode] = useState<OptimizeOptions["mode"]>("native");
  const [lossless, setLossless] = useState(false);
  const [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(false),
    [label, setLabel] = useState("Compressing PDF…");
  const { processing, progress, run, cancel } = useProcessingTask();
  const generation = useRef(0),
    controller = useRef<AbortController | null>(null),
    downloaded = useRef<Result | null>(null),
    addMore = useRef<HTMLInputElement>(null);
  const style = getCategoryStyle(tool),
    ToolIcon = tool.icon;
  const ready = entries.filter((e) => e.result),
    totalBytes = entries.reduce((n, e) => n + e.file.size, 0);
  const ids = entries.map((e) => e.id).join(",");
  useEffect(() => {
    if (processing || result) return;
    const abort = new AbortController();
    const pending = entries.filter((e) => !e.thumbnail && !e.previewError);
    void (async () => {
      for (const entry of pending) {
        if (abort.signal.aborted) return;
        try {
          const preview = await optimizationPreview(entry.file, abort.signal);
          if (!abort.signal.aborted)
            setEntries((v) =>
              v.map((e) => (e.id === entry.id ? { ...e, ...preview } : e)),
            );
        } catch {
          if (!abort.signal.aborted)
            setEntries((v) =>
              v.map((e) =>
                e.id === entry.id
                  ? { ...e, previewError: "Preview unavailable" }
                  : e,
              ),
            );
        }
      }
    })();
    return () => abort.abort();
    // Pause previews while exporting so a batch does not render and encode at once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, processing, result]);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
      cancel();
    },
    [cancel],
  );
  useEffect(() => {
    if (result && downloaded.current !== result) {
      downloaded.current = result;
      downloadBlob(result.blob, result.name);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (!result) downloaded.current = null;
  }, [result]);
  const stop = () => {
    generation.current++;
    controller.current?.abort();
    cancel();
    setLoading(false);
  };
  const reset = () => {
    stop();
    setEntries([]);
    setResult(null);
    setError("");
    setQuality("medium");
    setMode("native");
    setLossless(false);
  };
  const change = (update: () => void) => {
    update();
    setEntries((v) =>
      v.map((e) => ({ ...e, result: undefined, error: undefined })),
    );
    setError("");
  };
  const choose = async (files: File[]) => {
    if (!files.length || processing || loading) return;
    const token = ++generation.current;
    setLoading(true);
    setError("");
    try {
      if (
        files.some(
          (f) =>
            !f.size ||
            f.size > 100 * 1024 * 1024 ||
            (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf"),
        )
      )
        throw new Error("Choose non-empty PDF files up to 100MB each.");
      if (
        entries.length + files.length > 20 ||
        totalBytes + files.reduce((n, f) => n + f.size, 0) > 200 * 1024 * 1024
      )
        throw new Error("Choose up to 20 PDFs and 200MB combined.");
      const added: Entry[] = [];
      for (const f of files) {
        const stable = new File([await f.arrayBuffer()], f.name, {
          type: "application/pdf",
        });
        if (token !== generation.current) return;
        added.push({ id: crypto.randomUUID(), file: stable, rotation: 0 });
      }
      if (token === generation.current) {
        setEntries((v) => [...v, ...added]);
        setResult(null);
      }
    } catch (cause) {
      if (token === generation.current)
        setError(
          cause instanceof Error ? cause.message : "Choose readable PDFs.",
        );
    } finally {
      if (token === generation.current) setLoading(false);
    }
  };
  const execute = (downloadOnly = false) => {
    if (processing || loading || !entries.length) return;
    const abort = new AbortController();
    controller.current = abort;
    setError("");
    void run(
      async (setProgress, cancelled) => {
        let current = entries;
        if (!downloadOnly) {
          const targets = current.filter((e) => !e.result);
          for (const [index, entry] of targets.entries()) {
            if (cancelled() || abort.signal.aborted) return;
            setLabel(
              `Compressing ${index + 1} of ${targets.length} unfinished files…`,
            );
            try {
              const output = await optimizePdf(entry.file, {
                quality,
                mode,
                lossless,
                rotation: entry.rotation,
                signal: abort.signal,
                onProgress: (pct) =>
                  setProgress(((index + pct / 100) / targets.length) * 85),
              });
              if (cancelled() || abort.signal.aborted) return;
              if (
                current.reduce(
                  (size, e) => size + (e.result?.blob.size || 0),
                  output.blob.size,
                ) >
                200 * 1024 * 1024
              )
                throw new Error(
                  "Completed files reached the 200MB batch limit. Download and remove them, then retry this file.",
                );
              current = current.map((e) =>
                e.id === entry.id
                  ? { ...e, result: output, error: undefined }
                  : e,
              );
            } catch (cause) {
              if (cancelled() || abort.signal.aborted) return;
              current = current.map((e) =>
                e.id === entry.id
                  ? {
                      ...e,
                      error:
                        cause instanceof Error
                          ? cause.message
                          : "Could not compress this PDF.",
                    }
                  : e,
              );
            }
            setEntries((v) =>
              v.map((e) => {
                const done = current.find((c) => c.id === e.id);
                return done
                  ? { ...e, result: done.result, error: done.error }
                  : e;
              }),
            );
          }
          const unfinished = current.filter((e) => !e.result).length;
          if (unfinished)
            throw new Error(
              `${current.length - unfinished} ready · ${unfinished} unfinished. Remove or review the marked files, then retry. Completed files are kept.`,
            );
        }
        const completed = current.filter((e) => e.result);
        if (!completed.length)
          throw new Error("There are no completed files to download.");
        setLabel("Preparing download…");
        setProgress(90);
        const blob =
          completed.length === 1
            ? completed[0].result!.blob
            : await passwordZip(
                completed.map((e) => ({
                  name: filename(e.file),
                  blob: e.result!.blob,
                })),
                abort.signal,
              );
        if (cancelled() || abort.signal.aborted) return;
        setResult({
          entries: completed,
          blob,
          name:
            completed.length === 1
              ? filename(completed[0].file)
              : "compressed_pdfs.zip",
          unfinished: current.length - completed.length,
        });
        setProgress(100);
      },
      {
        toolName: "compress-pdf",
        successMessage: "Your PDF download is ready",
        errorTitle: "Review the unfinished files",
        onError: (cause) => {
          const message =
            cause instanceof Error
              ? cause.message
              : "Check the files and retry.";
          setError(message);
          return message;
        },
      },
    );
  };
  if (result) {
    const before = result.entries.reduce((n, e) => n + e.file.size, 0),
      after = result.entries.reduce((n, e) => n + e.result!.blob.size, 0),
      saved = Math.round(((before - after) / before) * 100);
    return (
      <PdfToolResultLayout toolSlug="compress-pdf">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-600" />
          <div>
            <h2 className="text-2xl font-bold">
              Your PDF{result.entries.length > 1 ? "s are" : " is"} ready
            </h2>
            <p className="mt-2 text-muted-foreground">
              {saved > 0
                ? `${saved}% smaller`
                : after > before
                  ? "Rotation applied; file size increased"
                  : "Size unchanged"}{" "}
              · {formatFileSize(before)} → {formatFileSize(after)}
            </p>
          </div>
          {result.unfinished > 0 && (
            <p
              role="alert"
              className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
            >
              {result.unfinished} unfinished file
              {result.unfinished === 1 ? " is" : "s are"} not included. Return
              to files to review.
            </p>
          )}
          <div className="w-full space-y-3 text-left">
            {result.entries.map((e) => (
              <div key={e.id} className="rounded-xl border p-4">
                <p className="break-all font-medium">{filename(e.file)}</p>
                <p className="mt-1 text-sm">
                  {formatFileSize(e.file.size)} →{" "}
                  {formatFileSize(e.result!.blob.size)} · {e.result!.pageCount}{" "}
                  pages
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {e.result!.unchanged
                    ? "Original returned unchanged: this setting did not make it smaller."
                    : e.result!.flattened
                      ? "Image-only pages: searchable text, links and editable form fields were flattened."
                      : `Native text, links and ${e.result!.fieldCount} form fields retained.`}
                  {!!e.rotation && ` Every page rotated +${e.rotation}°.`}
                </p>
                {result.entries.length > 1 && (
                  <Button
                    className="mt-3"
                    variant="outline"
                    onClick={() =>
                      downloadBlob(e.result!.blob, filename(e.file))
                    }
                  >
                    Download {e.file.name}
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              onClick={() => downloadBlob(result.blob, result.name)}
            >
              <Download size={18} />
              Download {result.entries.length > 1 ? "ZIP" : "PDF"}
            </Button>
            <Button variant="outline" onClick={() => setResult(null)}>
              Back to files
            </Button>
            <Button variant="outline" onClick={reset}>
              <UiText text="Start Over" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Your download starts automatically. Review image quality before
            sharing.
          </p>
        </div>
      </PdfToolResultLayout>
    );
  }
  if (!entries.length)
    return (
      <>
        <PdfToolLanding
          title={landingCopy.title}
          description={landingCopy.description}
          buttonLabel={landingCopy.buttonLabel}
          dropLabel={landingCopy.dropLabel}
          limitLabel={landingCopy.limitLabel}
          accept={{ "application/pdf": [".pdf"] }}
          multiple
          icon={ToolIcon}
          iconClass={style.iconClass}
          iconBackgroundClass={style.bgClass}
          accent="emerald"
          onFilesSelected={choose}
        />
        <div className="mx-auto mb-8 max-w-2xl px-4 text-center text-sm">
          {loading ? (
            <ProcessingState
              progress={0}
              label="Preparing PDFs…"
              onCancel={stop}
            />
          ) : error ? (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          ) : (
            <p className="text-muted-foreground">
              20 PDFs · 100MB each · 200MB combined. Native compression keeps
              text, links and editable forms.
            </p>
          )}
        </div>
      </>
    );
  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50">
      <PdfWorkspaceBar
        title="Compress PDF"
        meta={
          <>
            {entries.length} file{entries.length === 1 ? "" : "s"} ·{" "}
            {formatFileSize(totalBytes)} · {ready.length} ready
          </>
        }
        actions={
          <>
            <input
              ref={addMore}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                void choose(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
            {entries.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={processing || loading}
                  onClick={() =>
                    setEntries((v) =>
                      [...v].sort((a, b) =>
                        a.file.name.localeCompare(b.file.name, undefined, {
                          numeric: true,
                        }),
                      ),
                    )
                  }
                >
                  <ArrowDownAZ size={16} /> A–Z
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={processing || loading}
                  onClick={() =>
                    setEntries((v) =>
                      [...v].sort((a, b) =>
                        b.file.name.localeCompare(a.file.name, undefined, {
                          numeric: true,
                        }),
                      ),
                    )
                  }
                >
                  <ArrowUpZA size={16} /> Z–A
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={processing || loading}
            >
              <UiText text="Clear" />
            </Button>
          </>
        }
      />
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative min-h-[400px] border-b p-5 lg:min-h-[620px] lg:border-b-0 lg:border-r lg:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Your PDFs</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Rotate all pages in a file or remove it.
                </p>
              </div>
              <PdfAddButton cloud={{ accept: { "application/pdf": [".pdf"] }, multiple: true, onFilesSelected: choose }}
                count={entries.length}
                label="Add more PDFs"
                accent="emerald"
                disabled={processing || loading}
                onClick={() => addMore.current?.click()}
              />
            </div>
            <div className="grid grid-cols-1 justify-items-center gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry, index) => (
                <FileCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  disabled={processing || loading}
                  onRemove={() => {
                    setEntries((v) => v.filter((e) => e.id !== entry.id));
                    setError("");
                  }}
                  onRotate={() => {
                    setEntries((v) =>
                      v.map((e) =>
                        e.id === entry.id
                          ? {
                              ...e,
                              rotation: ((e.rotation + 90) %
                                360) as Entry["rotation"],
                              result: undefined,
                              error: undefined,
                            }
                          : e,
                      ),
                    );
                    setError("");
                  }}
                />
              ))}
            </div>
          </div>
        </section>
        <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[560px] lg:p-6">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-5 flex shrink-0 items-center gap-3 border-b pb-4">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  style.bgClass,
                )}
              >
                <ToolIcon className={cn("h-5 w-5", style.iconClass)} />
              </span>
              <div>
                <h2 className="text-xl font-bold">Compression level</h2>
                <p className="text-xs text-muted-foreground">
                  Choose the balance you need
                </p>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <label className="block text-sm font-medium">
                Compression method
                <select
                  className="mt-2 w-full rounded-xl border bg-background p-3 text-sm font-normal"
                  value={mode}
                  disabled={processing || loading}
                  onChange={(e) =>
                    change(() =>
                      setMode(e.target.value as OptimizeOptions["mode"]),
                    )
                  }
                >
                  <option value="native">Keep text and forms</option>
                  <option value="flatten">Image-only pages (flatten)</option>
                </select>
              </label>
              <p className="text-xs leading-5 text-muted-foreground">
                {mode === "native"
                  ? "Keep searchable text, graphics, links, forms and page dimensions. Image quality can change."
                  : "Every page becomes a JPEG image. Searchable text, links, editable fields, bookmarks and attachments are removed. Keep the original PDF."}
              </p>
              {mode === "native" && (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={lossless}
                    disabled={processing || loading}
                    onChange={(e) =>
                      change(() => setLossless(e.target.checked))
                    }
                  />
                  Preserve image quality (lossless)
                </label>
              )}
              <div
                role="radiogroup"
                aria-label="Compression level"
                className="space-y-3"
              >
                {QUALITY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    role="radio"
                    aria-checked={quality === option.id}
                    disabled={
                      processing || loading || (mode === "native" && lossless)
                    }
                    onClick={() => change(() => setQuality(option.id))}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50",
                      quality === option.id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                        : "border-slate-200 dark:border-slate-700",
                    )}
                  >
                    <span className="flex justify-between gap-2 text-sm font-semibold">
                      {option.label}
                      {quality === option.id && (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {lossless && mode === "native"
                  ? "Keep every image at its original quality. Some files will stay the same size."
                  : "Image quality may change. Keep text and forms does not resize images; Image-only uses 96/150/200 DPI for the three levels."}{" "}
                Without rotation, the original is returned if compression would
                make it larger.
              </p>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950"
                >
                  <AlertCircle className="mb-2 h-4 w-4" />
                  {error}
                </p>
              )}
            </div>
            {processing || loading ? (
              <div className="mt-5 shrink-0">
                <ProcessingState
                  progress={loading ? 0 : progress}
                  label={loading ? "Preparing PDFs…" : label}
                  onCancel={() => {
                    stop();
                    setError(
                      "Processing stopped. Completed files are kept; retry the unfinished files.",
                    );
                  }}
                />
              </div>
            ) : (
              <div className="mt-5 shrink-0 space-y-3">
                {ready.length < entries.length && (
                  <Button
                    size="lg"
                    className="min-h-16 w-full bg-slate-950 text-lg text-white hover:bg-emerald-500 hover:text-slate-950"
                    onClick={() => execute()}
                  >
                    {entries.some((e) => e.error)
                      ? "Retry unfinished PDFs"
                      : `Compress ${entries.length - ready.length} PDF${entries.length - ready.length === 1 ? "" : "s"}`}
                  </Button>
                )}
                {ready.length > 0 && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => execute(true)}
                  >
                    Download {ready.length} completed file
                    {ready.length === 1 ? "" : "s"}
                  </Button>
                )}
              </div>
            )}
            <p className="mt-4 shrink-0 text-xs leading-5 text-muted-foreground">
              20 PDFs · 100MB each · 200MB combined. Native: 1,000 pages;
              image-only: 200 pages. Encrypted, signed/certified and XFA PDFs
              are rejected. Files stay on your device.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
