"use client";

import { UiText } from "@/components/i18n/UiText";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bold, ImageIcon, Italic, Type, Underline, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  addWatermarkToPdf,
  mosaicCenters,
  positionCenter,
  type WatermarkFontFamily,
  type WatermarkLayer,
  type WatermarkPosition,
  type WatermarkRotation,
  type WatermarkSettings,
  type WatermarkTransparency,
} from "@/lib/engines/pdf-watermark-engine";
import { classifyPdfRenderError, PDF_RENDER_ERROR_MESSAGE, renderPdfPages } from "@/lib/engines/pdf-render-engine";
import { getCategoryStyle } from "@/lib/category-colors";
import { getTool } from "@/lib/tools";
import { cn, formatFileSize } from "@/lib/utils";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

interface WatermarkPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

const tool = getTool("/watermark-pdf")!;
const style = getCategoryStyle(tool);

const LANDING_COPY = {
  title: "Watermark PDF",
  description: "Stamp text or an image over your PDF pages — position, transparency, and rotation included.",
  buttonLabel: "Select PDF file",
  dropLabel: "or drag and drop a PDF file here",
  limitLabel: "100MB max per PDF",
};

const CARD_WIDTH = 150;
const MARGIN_PT = 36;

interface Thumb {
  pageNumber: number;
  dataUrl: string;
  widthPt: number;
  heightPt: number;
}

const FONT_OPTIONS: { value: WatermarkFontFamily; label: string }[] = [
  { value: "helvetica", label: "Arial" },
  { value: "times", label: "Times New Roman" },
  { value: "courier", label: "Courier" },
];

const TRANSPARENCY_OPTIONS: { value: WatermarkTransparency; label: string }[] = [
  { value: 100, label: "No transparency" },
  { value: 75, label: "75%" },
  { value: 50, label: "50%" },
  { value: 25, label: "25%" },
];

const ROTATION_OPTIONS: { value: WatermarkRotation; label: string }[] = [
  { value: 0, label: "Do not rotate" },
  { value: 45, label: "45 degrees" },
  { value: 90, label: "90 degrees" },
  { value: 180, label: "180 degrees" },
  { value: 270, label: "270 degrees" },
];

const COLOR_PRESETS = ["#1f2937", "#595959", "#dc2626", "#2563eb", "#059669", "#ffffff"];

function PositionGrid({ value, onChange, disabled }: { value: WatermarkPosition; onChange: (p: WatermarkPosition) => void; disabled?: boolean }) {
  return (
    <div className={cn("grid h-24 w-24 grid-cols-3 grid-rows-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-950/50", disabled && "opacity-40")}>
      {Array.from({ length: 9 }, (_, i) => i).map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`Position ${i + 1} of 9`}
          aria-pressed={value === i}
          disabled={disabled}
          onClick={() => onChange(i as WatermarkPosition)}
          className={cn(
            "flex items-center justify-center rounded-md border transition-colors",
            value === i
              ? "border-orange-500 bg-orange-500"
              : "border-slate-200 bg-white hover:border-orange-300 dark:border-slate-700 dark:bg-slate-900"
          )}
        >
          {value === i && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </button>
      ))}
    </div>
  );
}

function WatermarkOverlay({ thumb, settings, imagePreviewUrl }: { thumb: Thumb; settings: WatermarkSettings; imagePreviewUrl: string | null }) {
  const centers = settings.mosaic
    ? mosaicCenters(thumb.widthPt, thumb.heightPt)
    : [positionCenter(settings.position, thumb.widthPt, thumb.heightPt, MARGIN_PT)];

  const cssFont =
    settings.fontFamily === "helvetica" ? "Arial, Helvetica, sans-serif" : settings.fontFamily === "times" ? "'Times New Roman', Times, serif" : "'Courier New', Courier, monospace";
  const overlayFontPx = Math.max(5, settings.fontSize * (CARD_WIDTH / thumb.widthPt));
  const wPx = CARD_WIDTH * 0.3;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: settings.layer === "below" ? 0 : 10 }}>
      {centers.map(({ cx, cy }, i) => {
        const x = cx * (CARD_WIDTH / thumb.widthPt);
        const y = cy * (CARD_WIDTH / thumb.widthPt);
        const topPx = thumb.heightPt * (CARD_WIDTH / thumb.widthPt) - y;
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: x,
              top: topPx,
              transform: `translate(-50%, -50%) rotate(${-settings.rotation}deg)`,
              opacity: settings.transparency / 100,
            }}
          >
            {settings.mode === "text" ? (
              <span
                className="whitespace-nowrap"
                style={{
                  fontFamily: cssFont,
                  fontSize: overlayFontPx,
                  fontWeight: settings.bold ? 700 : 400,
                  fontStyle: settings.italic ? "italic" : "normal",
                  textDecoration: settings.underline ? "underline" : "none",
                  color: settings.color,
                }}
              >
                {settings.text || " "}
              </span>
            ) : imagePreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview of the selected watermark image
              <img src={imagePreviewUrl} alt="" style={{ width: wPx, height: "auto" }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PagePreviewCard({ thumb, watermarked, settings, imagePreviewUrl }: { thumb: Thumb; watermarked: boolean; settings: WatermarkSettings; imagePreviewUrl: string | null }) {
  const heightPx = CARD_WIDTH * (thumb.heightPt / thumb.widthPt);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900" style={{ width: CARD_WIDTH }}>
      <div className="relative bg-muted" style={{ width: CARD_WIDTH, height: heightPx }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot, not an optimizable remote asset */}
        <img src={thumb.dataUrl} alt="" className="block h-full w-full object-contain" style={{ position: "relative", zIndex: 5 }} />
        {watermarked && <WatermarkOverlay thumb={thumb} settings={settings} imagePreviewUrl={imagePreviewUrl} />}
      </div>
      <div className="border-t border-slate-100 px-2 py-1.5 text-center text-[11px] text-muted-foreground dark:border-slate-800">
        Page {thumb.pageNumber}
      </div>
    </div>
  );
}

export function WatermarkPdfClient({}: WatermarkPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<Thumb[]>([]);
  const [thumbnailsLoading, setThumbnailsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; pageCount: number } | null>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, failed, run, cancel } = useProcessingTask();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [settings, setSettings] = useState<WatermarkSettings>({
    mode: "text",
    text: "CONFIDENTIAL",
    fontFamily: "helvetica",
    fontSize: 32,
    bold: true,
    italic: false,
    underline: false,
    color: "#595959",
    position: 4,
    mosaic: false,
    transparency: 50,
    rotation: 45,
    fromPage: 1,
    toPage: 1,
    layer: "over",
  });
  const patch = (partial: Partial<WatermarkSettings>) => setSettings((s) => ({ ...s, ...partial }));

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

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const rangeValid = settings.fromPage >= 1 && settings.toPage >= settings.fromPage && settings.toPage <= Math.max(pageCount, 1);
  const modeReady = settings.mode === "text" ? settings.text.trim().length > 0 : Boolean(imageFile);
  const canConvert = Boolean(file) && !loadError && !thumbnailsLoading && rangeValid && modeReady;

  const convert = () => {
    if (!file || !canConvert) return;
    run(
      async (setProgress) => {
        setResult(null);
        autoDownloadRef.current = false;
        const output = await addWatermarkToPdf(file, settings, imageFile, setProgress);
        setResult(output);
      },
      {
        successMessage: "Watermark added successfully!",
        toolName: "watermark-pdf",
        errorTitle: "Failed to add watermark",
        onError: (error) => {
          console.error("Error adding watermark:", error);
          return error instanceof Error ? error.message : "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (result) downloadBlob(result.blob, "watermarked.pdf");
  };

  const clear = () => {
    setFile(null);
    setThumbnails([]);
    setLoadError(null);
    setResult(null);
    setImageFile(null);
    autoDownloadRef.current = false;
  };

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="watermark-pdf">
        <ResultState
          resultFilename="watermarked.pdf"
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
        title="Watermark PDF"
        meta={<>{file.name} · {formatFileSize(file.size)}{pageCount > 0 ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}</>}
        actions={
          <Button variant="ghost" size="sm" onClick={clear} disabled={processing}>
            <UiText text="Change file" />
          </Button>
        }
      />
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-h-[620px] overflow-y-auto border-b p-5 lg:border-b-0 lg:border-r lg:p-8 lg:h-[calc(100vh-8.15rem)]">
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
          ) : (
            <div className="flex flex-wrap gap-4">
              {thumbnails.map((thumb) => (
                <PagePreviewCard
                  key={thumb.pageNumber}
                  thumb={thumb}
                  watermarked={thumb.pageNumber >= settings.fromPage && thumb.pageNumber <= settings.toPage && modeReady}
                  settings={settings}
                  imagePreviewUrl={imagePreviewUrl}
                />
              ))}
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
                <h2 className="text-xl font-bold tracking-tight">Watermark options</h2>
                <p className="text-xs text-slate-500"><UiText text="Preview updates as you choose" /></p>
              </div>
            </div>

            {!loadError && (
              <>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-2.5" role="tablist" aria-label="Watermark type">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={settings.mode === "text"}
                      onClick={() => patch({ mode: "text" })}
                      className={cn(
                        "flex min-h-11 items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-medium transition-colors",
                        settings.mode === "text"
                          ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-200"
                          : "border-slate-200 text-slate-500 hover:border-orange-300 dark:border-slate-700"
                      )}
                    >
                      <Type className="h-4 w-4" aria-hidden /> Place text
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={settings.mode === "image"}
                      onClick={() => patch({ mode: "image" })}
                      className={cn(
                        "flex min-h-11 items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-medium transition-colors",
                        settings.mode === "image"
                          ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-200"
                          : "border-slate-200 text-slate-500 hover:border-orange-300 dark:border-slate-700"
                      )}
                    >
                      <ImageIcon className="h-4 w-4" aria-hidden /> Place image
                    </button>
                  </div>

                  {settings.mode === "text" ? (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100"><UiText text="Text" /></label>
                        <input
                          type="text"
                          value={settings.text}
                          onChange={(e) => patch({ text: e.target.value })}
                          placeholder="CONFIDENTIAL"
                          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-900"
                        />
                        {!settings.text.trim() && <p className="mt-1.5 text-xs text-destructive">Enter watermark text.</p>}
                      </div>

                      <div>
                        <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100"><UiText text="Text format" /></p>
                        <div className="space-y-2.5 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                          <select
                            value={settings.fontFamily}
                            onChange={(e) => patch({ fontFamily: e.target.value as WatermarkFontFamily })}
                            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-900"
                          >
                            {FONT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>

                          <div className="flex items-center gap-2.5">
                            <input
                              type="range"
                              min={8}
                              max={96}
                              value={settings.fontSize}
                              onChange={(e) => patch({ fontSize: Number(e.target.value) })}
                              className="h-2 flex-1 accent-orange-500"
                              aria-label="Font size"
                            />
                            <input
                              type="number"
                              min={8}
                              max={96}
                              value={settings.fontSize}
                              onChange={(e) => patch({ fontSize: Math.min(96, Math.max(8, Number(e.target.value) || 32)) })}
                              className="h-9 w-16 rounded-lg border border-slate-300 bg-white px-2 text-center text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-900"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button type="button" aria-pressed={settings.bold} onClick={() => patch({ bold: !settings.bold })} className={cn("flex h-9 w-9 items-center justify-center rounded-lg border transition", settings.bold ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-200" : "border-slate-200 text-slate-500 hover:border-orange-300 dark:border-slate-700")}>
                              <Bold className="h-4 w-4" aria-hidden />
                            </button>
                            <button type="button" aria-pressed={settings.italic} onClick={() => patch({ italic: !settings.italic })} className={cn("flex h-9 w-9 items-center justify-center rounded-lg border transition", settings.italic ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-200" : "border-slate-200 text-slate-500 hover:border-orange-300 dark:border-slate-700")}>
                              <Italic className="h-4 w-4" aria-hidden />
                            </button>
                            <button type="button" aria-pressed={settings.underline} onClick={() => patch({ underline: !settings.underline })} className={cn("flex h-9 w-9 items-center justify-center rounded-lg border transition", settings.underline ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-200" : "border-slate-200 text-slate-500 hover:border-orange-300 dark:border-slate-700")}>
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
                    </>
                  ) : (
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">Watermark image</label>
                      {imageFile ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                          {imagePreviewUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imagePreviewUrl} alt="" className="h-12 w-12 rounded-lg border border-slate-200 object-contain dark:border-slate-700" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{imageFile.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(imageFile.size)}</p>
                          </div>
                          <button type="button" onClick={() => setImageFile(null)} aria-label="Remove watermark image" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-destructive dark:hover:bg-slate-800">
                            <X className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      ) : (
                        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-4 text-center transition hover:border-orange-300 hover:bg-orange-50/40 dark:border-slate-700 dark:hover:bg-orange-950/10">
                          <Upload className="h-5 w-5 text-slate-400" aria-hidden />
                          <span className="text-sm font-medium">Add image</span>
                          <span className="text-xs text-muted-foreground">PNG or JPG</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setImageFile(f);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                      )}
                      {!imageFile && <p className="mt-1.5 text-xs text-destructive">Choose a watermark image.</p>}
                    </div>
                  )}

                  <div className="flex gap-4">
                    <div>
                      <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100"><UiText text="Position" /></p>
                      <PositionGrid value={settings.position} onChange={(position) => patch({ position })} disabled={settings.mosaic} />
                      <label className="mt-2.5 flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                        <input type="checkbox" checked={settings.mosaic} onChange={(e) => patch({ mosaic: e.target.checked })} className="h-4.5 w-4.5 rounded border-slate-300 accent-orange-500" />
                        Mosaic
                      </label>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">Transparency</label>
                        <select value={settings.transparency} onChange={(e) => patch({ transparency: Number(e.target.value) as WatermarkTransparency })} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-900">
                          {TRANSPARENCY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">Rotation</label>
                        <select value={settings.rotation} onChange={(e) => patch({ rotation: Number(e.target.value) as WatermarkRotation })} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-900">
                          {ROTATION_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><UiText text="Pages" /></p>
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
                    {!rangeValid && <p className="mt-1.5 text-xs text-destructive">Choose a valid page range (1–{pageCount}).</p>}
                  </div>

                  <div>
                    <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">Layer</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {(["over", "below"] as WatermarkLayer[]).map((l) => (
                        <button
                          key={l}
                          type="button"
                          aria-pressed={settings.layer === l}
                          onClick={() => patch({ layer: l })}
                          className={cn(
                            "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-xs font-medium transition-colors",
                            settings.layer === l
                              ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-200"
                              : "border-slate-200 text-slate-500 hover:border-orange-300 dark:border-slate-700"
                          )}
                        >
                          {l === "over" ? "Over the PDF content" : "Below the PDF content"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {failed && !processing && (
                    <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <p>Couldn&apos;t add the watermark. Please try again with a valid PDF file.</p>
                    </div>
                  )}
                </div>

                {processing ? (
                  <div className="mt-5 shrink-0">
                    <ProcessingState progress={progress} onCancel={cancel} label="Adding watermark…" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={convert}
                    disabled={!canConvert}
                    className="mt-5 flex min-h-16 w-full shrink-0 items-center justify-center rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0"
                  >
                    {failed ? "Try Again" : "Add watermark"}
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
