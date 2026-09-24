"use client";

import { UiText } from "@/components/i18n/UiText";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Bold, Hash, Italic, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  addPageNumbersToPdf,
  formatPageLabel,
  isLeftPageOfSpread,
  mirroredPosition,
  MARGIN_POINTS,
  type PageNumberFontFamily,
  type PageNumberMargin,
  type PageNumberSettings,
  type PagePosition,
  type TextFormatPreset,
} from "@/lib/engines/pdf-page-numbers-engine";
import { classifyPdfRenderError, PDF_RENDER_ERROR_MESSAGE, renderPdfPages } from "@/lib/engines/pdf-render-engine";
import { getCategoryStyle } from "@/lib/category-colors";
import { getTool } from "@/lib/tools";
import { cn, formatFileSize } from "@/lib/utils";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

interface AddPageNumbersClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

const tool = getTool("/add-page-numbers")!;
const style = getCategoryStyle(tool);

const LANDING_COPY = {
  title: "Add Page Numbers",
  description: "Number the pages of a PDF — choose the position, format, range, and style.",
  buttonLabel: "Select PDF file",
  dropLabel: "or drag and drop a PDF file here",
  limitLabel: "100MB max per PDF",
};

const CARD_WIDTH = 150;

interface Thumb {
  pageNumber: number;
  dataUrl: string;
  widthPt: number;
  heightPt: number;
}

const TEXT_FORMAT_OPTIONS: { value: TextFormatPreset; label: string }[] = [
  { value: "number", label: "Page number only (recommended)" },
  { value: "page-n", label: "Page {n}" },
  { value: "page-n-of-p", label: "Page {n} of {p}" },
  { value: "custom", label: "Custom" },
];

const MARGIN_OPTIONS: { value: PageNumberMargin; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "recommended", label: "Recommended" },
  { value: "big", label: "Big" },
];

const FONT_OPTIONS: { value: PageNumberFontFamily; label: string }[] = [
  { value: "helvetica", label: "Arial" },
  { value: "times", label: "Times New Roman" },
  { value: "courier", label: "Courier" },
];

const COLOR_PRESETS = ["#1f2937", "#595959", "#dc2626", "#2563eb", "#059669", "#ffffff"];

function PositionGrid({ value, onChange, mirrored }: { value: PagePosition; onChange: (p: PagePosition) => void; mirrored?: boolean }) {
  const shown = mirroredPosition(value, Boolean(mirrored));
  return (
    <div className="grid h-24 w-24 grid-cols-3 grid-rows-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-950/50">
      {Array.from({ length: 9 }, (_, i) => i).map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`Position ${i + 1} of 9`}
          aria-pressed={shown === i}
          onClick={() => onChange(mirroredPosition(i as PagePosition, Boolean(mirrored)))}
          className={cn(
            "flex items-center justify-center rounded-md border transition-colors",
            shown === i
              ? "border-orange-500 bg-orange-500"
              : "border-slate-200 bg-white hover:border-orange-300 dark:border-slate-700 dark:bg-slate-900"
          )}
        >
          {shown === i && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </button>
      ))}
    </div>
  );
}

function PagePreviewCard({
  thumb,
  label,
  numbered,
  position,
  margin,
  fontFamily,
  fontSize,
  bold,
  italic,
  underline,
  color,
}: {
  thumb: Thumb;
  label: string;
  numbered: boolean;
  position: PagePosition;
  margin: PageNumberMargin;
  fontFamily: PageNumberFontFamily;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
}) {
  const heightPx = CARD_WIDTH * (thumb.heightPt / thumb.widthPt);
  const marginPx = MARGIN_POINTS[margin] * (CARD_WIDTH / thumb.widthPt);
  const overlayFontPx = Math.max(5, fontSize * (CARD_WIDTH / thumb.widthPt));
  const row = Math.floor(position / 3);
  const col = position % 3;
  const cssFont = fontFamily === "helvetica" ? "Arial, Helvetica, sans-serif" : fontFamily === "times" ? "'Times New Roman', Times, serif" : "'Courier New', Courier, monospace";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900" style={{ width: CARD_WIDTH }}>
      <div className="relative bg-muted" style={{ width: CARD_WIDTH, height: heightPx }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot, not an optimizable remote asset */}
        <img src={thumb.dataUrl} alt="" className="block h-full w-full object-contain" />
        {numbered && (
          <span
            className="pointer-events-none absolute whitespace-nowrap"
            style={{
              fontFamily: cssFont,
              fontSize: overlayFontPx,
              fontWeight: bold ? 700 : 400,
              fontStyle: italic ? "italic" : "normal",
              textDecoration: underline ? "underline" : "none",
              color,
              top: row === 0 ? marginPx : row === 1 ? "50%" : undefined,
              bottom: row === 2 ? marginPx : undefined,
              left: col === 0 ? marginPx : col === 1 ? "50%" : undefined,
              right: col === 2 ? marginPx : undefined,
              transform: `${col === 1 ? "translateX(-50%)" : ""} ${row === 1 ? "translateY(-50%)" : ""}`.trim() || undefined,
            }}
          >
            {label}
          </span>
        )}
      </div>
      <div className="border-t border-slate-100 px-2 py-1.5 text-center text-[11px] text-muted-foreground dark:border-slate-800">
        Page {thumb.pageNumber}
      </div>
    </div>
  );
}

export function AddPageNumbersClient({}: AddPageNumbersClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<Thumb[]>([]);
  const [thumbnailsLoading, setThumbnailsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; pageCount: number } | null>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, failed, run, cancel } = useProcessingTask();

  const [settings, setSettings] = useState<PageNumberSettings>({
    pageMode: "single",
    firstPageCover: false,
    position: 8,
    margin: "recommended",
    firstNumber: 1,
    fromPage: 1,
    toPage: 1,
    textFormat: "number",
    customText: "Page {n} of {p}",
    fontFamily: "helvetica",
    fontSize: 10,
    bold: false,
    italic: false,
    underline: false,
    color: "#595959",
  });
  const patch = (partial: Partial<PageNumberSettings>) => setSettings((s) => ({ ...s, ...partial }));

  const pageCount = thumbnails.length;

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setThumbnails([]);
      setLoadError(null);
      setResult(null);
      autoDownloadRef.current = false;
    }
  };

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setThumbnailsLoading(true);
    setLoadError(null);

    renderPdfPages(file, { scale: 0.6 })
      .then((pages) => {
        if (cancelled) return;
        const thumbs: Thumb[] = pages.map((p) => ({
          pageNumber: p.pageNumber,
          dataUrl: p.canvas.toDataURL("image/png"),
          widthPt: p.canvas.width / 0.6,
          heightPt: p.canvas.height / 0.6,
        }));
        setThumbnails(thumbs);
        patch({ fromPage: 1, toPage: thumbs.length });
        setThumbnailsLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error rendering PDF pages:", error);
        setLoadError(PDF_RENDER_ERROR_MESSAGE[classifyPdfRenderError(error)]);
        setThumbnailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally file-only: settings changes must not re-render pages
  }, [file]);

  const spreads = useMemo(() => {
    if (settings.pageMode !== "facing") return thumbnails.map((t) => [t]);
    const groups: Thumb[][] = [];
    let i = 0;
    if (settings.firstPageCover && thumbnails.length > 0) {
      groups.push([thumbnails[0]]);
      i = 1;
    }
    for (; i < thumbnails.length; i += 2) {
      groups.push(thumbnails[i + 1] ? [thumbnails[i], thumbnails[i + 1]] : [thumbnails[i]]);
    }
    return groups;
  }, [thumbnails, settings.pageMode, settings.firstPageCover]);

  const rangeValid = settings.fromPage >= 1 && settings.toPage >= settings.fromPage && settings.toPage <= Math.max(pageCount, 1);
  const canConvert = Boolean(file) && !loadError && !thumbnailsLoading && rangeValid;

  const convert = () => {
    if (!file || !canConvert) return;
    run(
      async (setProgress) => {
        setResult(null);
        autoDownloadRef.current = false;
        const output = await addPageNumbersToPdf(file, settings, setProgress);
        setResult(output);
      },
      {
        successMessage: "Page numbers added!",
        toolName: "add-page-numbers",
        errorTitle: "Failed to add page numbers",
        onError: (error) => {
          console.error("Error adding page numbers:", error);
          return "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (result) downloadBlob(result.blob, "numbered.pdf");
  };

  const clear = () => {
    setFile(null);
    setThumbnails([]);
    setLoadError(null);
    setResult(null);
    autoDownloadRef.current = false;
  };

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="add-page-numbers">
        <ResultState
          resultFilename="numbered.pdf"
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

  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50">
      <PdfWorkspaceBar
        title="Add Page Numbers"
        meta={<>{file.name} · {formatFileSize(file.size)}{pageCount > 0 ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}</>}
        actions={
          <Button variant="ghost" size="sm" onClick={clear} disabled={processing}>
            <UiText text="Change file" />
          </Button>
        }
      />
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-h-[620px] overflow-y-auto border-b p-5 lg:h-[calc(100vh-8.15rem)] lg:border-b-0 lg:border-r lg:p-8">
          <div className="mb-6">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200"><UiText text="Preview your pages" /></p>
            <p className="mt-1 text-xs text-slate-500">The preview updates as you change the options.</p>
          </div>

          {thumbnailsLoading ? (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite"><UiText text="Rendering page previews…" /></p>
          ) : loadError ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
              <div className="space-y-2">
                <p className="text-destructive">{loadError}</p>
                <Button variant="outline" size="sm" onClick={clear}>
                  <UiText text="Choose a Different File" />
                </Button>
              </div>
            </div>
          ) : settings.pageMode === "single" ? (
            <div className="flex flex-wrap gap-4">
              {thumbnails.map((thumb) => {
                const pageIndex0 = thumb.pageNumber - 1;
                const numbered = thumb.pageNumber >= settings.fromPage && thumb.pageNumber <= settings.toPage;
                const running = settings.firstNumber + (numbered ? countNumberedBefore(thumbnails, settings, pageIndex0) : 0);
                return (
                  <PagePreviewCard
                    key={thumb.pageNumber}
                    thumb={thumb}
                    numbered={numbered}
                    label={formatPageLabel(settings, running, pageCount)}
                    position={settings.position}
                    margin={settings.margin}
                    fontFamily={settings.fontFamily}
                    fontSize={settings.fontSize}
                    bold={settings.bold}
                    italic={settings.italic}
                    underline={settings.underline}
                    color={settings.color}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {spreads.map((group, groupIndex) => (
                <div key={groupIndex} className="flex gap-1 rounded-xl border border-slate-200 bg-white/70 p-2 dark:border-slate-800 dark:bg-slate-900/45">
                  {group.map((thumb) => {
                    const pageIndex0 = thumb.pageNumber - 1;
                    const numbered = thumb.pageNumber >= settings.fromPage && thumb.pageNumber <= settings.toPage;
                    const running = settings.firstNumber + (numbered ? countNumberedBefore(thumbnails, settings, pageIndex0) : 0);
                    const mirror = group.length === 2 && isLeftPageOfSpread(pageIndex0, settings.firstPageCover);
                    return (
                      <PagePreviewCard
                        key={thumb.pageNumber}
                        thumb={thumb}
                        numbered={numbered}
                        label={formatPageLabel(settings, running, pageCount)}
                        position={mirroredPosition(settings.position, mirror)}
                        margin={settings.margin}
                        fontFamily={settings.fontFamily}
                        fontSize={settings.fontSize}
                        bold={settings.bold}
                        italic={settings.italic}
                        underline={settings.underline}
                        color={settings.color}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[560px] lg:p-6">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-5 flex shrink-0 items-center gap-3 border-b pb-4">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.bgClass)}>
                <Hash className={cn("h-5 w-5", style.iconClass)} aria-hidden />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Page number options</h2>
                <p className="text-xs text-slate-500"><UiText text="Preview updates as you choose" /></p>
              </div>
            </div>

            {!loadError && (
              <>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                  <div>
                    <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">Page mode</p>
                    <div className="grid grid-cols-2 gap-2.5" role="tablist" aria-label="Page mode">
                      {(["single", "facing"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          role="tab"
                          aria-selected={settings.pageMode === mode}
                          onClick={() => patch({ pageMode: mode })}
                          className={cn(
                            "flex min-h-11 items-center justify-center rounded-xl border p-2.5 text-sm font-medium transition-colors",
                            settings.pageMode === mode
                              ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-200"
                              : "border-slate-200 text-slate-500 hover:border-orange-300 dark:border-slate-700"
                          )}
                        >
                          {mode === "single" ? "Single page" : "Facing pages"}
                        </button>
                      ))}
                    </div>
                    {settings.pageMode === "facing" && (
                      <label className="mt-2.5 flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={settings.firstPageCover}
                          onChange={(e) => patch({ firstPageCover: e.target.checked })}
                          className="h-4.5 w-4.5 rounded border-slate-300 accent-orange-500"
                        />
                        First page is cover page
                      </label>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <div>
                      <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100"><UiText text="Position" /></p>
                      <PositionGrid
                        value={settings.position}
                        onChange={(position) => patch({ position })}
                        mirrored={settings.pageMode === "facing" && isLeftPageOfSpread(0, settings.firstPageCover)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-2.5 block text-sm font-semibold text-slate-800 dark:text-slate-100"><UiText text="Margin" /></label>
                      <select
                        value={settings.margin}
                        onChange={(e) => patch({ margin: e.target.value as PageNumberMargin })}
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-900"
                      >
                        {MARGIN_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">First number</label>
                      <input
                        type="number"
                        min={0}
                        value={settings.firstNumber}
                        onChange={(e) => patch({ firstNumber: Math.max(0, Number(e.target.value) || 0) })}
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Number pages</p>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={pageCount}
                          value={settings.fromPage}
                          aria-label="From page"
                          onChange={(e) => patch({ fromPage: Number(e.target.value) || 1 })}
                          className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-900"
                        />
                        <span className="shrink-0 text-xs text-slate-400">to</span>
                        <input
                          type="number"
                          min={1}
                          max={pageCount}
                          value={settings.toPage}
                          aria-label="To page"
                          onChange={(e) => patch({ toPage: Number(e.target.value) || 1 })}
                          className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                  {!rangeValid && (
                    <p className="text-xs text-destructive">Choose a valid page range (1–{pageCount}).</p>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100"><UiText text="Text" /></label>
                    <select
                      value={settings.textFormat}
                      onChange={(e) => patch({ textFormat: e.target.value as TextFormatPreset })}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {TEXT_FORMAT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {settings.textFormat === "custom" && (
                      <div className="mt-2.5">
                        <input
                          type="text"
                          value={settings.customText}
                          onChange={(e) => patch({ customText: e.target.value })}
                          placeholder="Page {n} of {p}"
                          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-900"
                        />
                        <p className="mt-1.5 text-xs text-slate-500">Use {"{n}"} for the page number and {"{p}"} for the total page count.</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100"><UiText text="Text format" /></p>
                    <div className="space-y-2.5 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                      <select
                        value={settings.fontFamily}
                        onChange={(e) => patch({ fontFamily: e.target.value as PageNumberFontFamily })}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-900"
                      >
                        {FONT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2.5">
                        <input
                          type="range"
                          min={6}
                          max={48}
                          value={settings.fontSize}
                          onChange={(e) => patch({ fontSize: Number(e.target.value) })}
                          className="h-2 flex-1 accent-orange-500"
                          aria-label="Font size"
                        />
                        <input
                          type="number"
                          min={6}
                          max={48}
                          value={settings.fontSize}
                          onChange={(e) => patch({ fontSize: Math.min(48, Math.max(6, Number(e.target.value) || 10)) })}
                          className="h-9 w-16 rounded-lg border border-slate-300 bg-white px-2 text-center text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-900"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-pressed={settings.bold}
                          onClick={() => patch({ bold: !settings.bold })}
                          className={cn("flex h-9 w-9 items-center justify-center rounded-lg border transition", settings.bold ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-200" : "border-slate-200 text-slate-500 hover:border-orange-300 dark:border-slate-700")}
                        >
                          <Bold className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-pressed={settings.italic}
                          onClick={() => patch({ italic: !settings.italic })}
                          className={cn("flex h-9 w-9 items-center justify-center rounded-lg border transition", settings.italic ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-200" : "border-slate-200 text-slate-500 hover:border-orange-300 dark:border-slate-700")}
                        >
                          <Italic className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-pressed={settings.underline}
                          onClick={() => patch({ underline: !settings.underline })}
                          className={cn("flex h-9 w-9 items-center justify-center rounded-lg border transition", settings.underline ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-200" : "border-slate-200 text-slate-500 hover:border-orange-300 dark:border-slate-700")}
                        >
                          <Underline className="h-4 w-4" aria-hidden />
                        </button>
                        <div className="ml-auto flex items-center gap-1.5">
                          {COLOR_PRESETS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              aria-label={`Use color ${c}`}
                              aria-pressed={settings.color === c}
                              onClick={() => patch({ color: c })}
                              className={cn("h-6 w-6 rounded-full border-2 transition", settings.color === c ? "border-orange-500" : "border-white dark:border-slate-900")}
                              style={{ backgroundColor: c, boxShadow: "0 0 0 1px rgba(15,23,42,0.15)" }}
                            />
                          ))}
                          <input
                            type="color"
                            value={settings.color}
                            onChange={(e) => patch({ color: e.target.value })}
                            aria-label="Custom color"
                            className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {failed && !processing && (
                  <div className="mb-3 flex shrink-0 items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p>Couldn&apos;t add page numbers. Please try again with a valid PDF file.</p>
                  </div>
                )}

                {processing ? (
                  <div className="mt-5 shrink-0">
                    <ProcessingState progress={progress} onCancel={cancel} label="Adding page numbers…" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={convert}
                    disabled={!canConvert}
                    className="mt-5 flex min-h-16 w-full shrink-0 items-center justify-center rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0"
                  >
                    {failed ? "Try Again" : "Add page numbers"}
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

/** How many pages before `pageIndex0` (0-based, within the numbered range)
 *  already received a number — used so the live preview's running count
 *  matches exactly what the engine will produce. */
function countNumberedBefore(thumbnails: Thumb[], settings: PageNumberSettings, pageIndex0: number): number {
  let count = 0;
  for (let i = 0; i < pageIndex0; i++) {
    const pageNumber1 = thumbnails[i].pageNumber;
    if (pageNumber1 >= settings.fromPage && pageNumber1 <= settings.toPage) count += 1;
  }
  return count;
}
