"use client";

import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Code2,
  Eye,
  FileCode,
  FileOutput,
  Globe2,
  Info,
  Loader2,
  Monitor,
  RefreshCw,
  Smartphone,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackToHome, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import {
  captureHtmlElementToPdfBlob,
  convertHtmlToPdfBlob,
  type HtmlPdfMargin,
  type HtmlPdfPageSize,
  type HtmlPdfScreenSize,
  type HtmlPdfSettings,
} from "@/lib/engines/html-to-pdf-engine";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getCategoryStyle } from "@/lib/category-colors";
import { getTool } from "@/lib/tools";
import { cn, formatFileSize } from "@/lib/utils";

const MAX_HTML_FILE_SIZE = 100 * 1024 * 1024;
const landingTool = getTool("/html-to-pdf")!;
const landingStyle = getCategoryStyle(landingTool);

type Source =
  | { kind: "url"; url: string; finalUrl: string; html: string; name: string }
  | { kind: "file"; file: File; html: string; name: string };

type ModalTab = "url" | "file";

const SCREEN_OPTIONS: { value: HtmlPdfScreenSize; label: string }[] = [
  { value: "current", label: "Your screen" },
  { value: "1920", label: "Desktop HD (1920px)" },
  { value: "1440", label: "Desktop (1440px)" },
  { value: "768", label: "Tablet (768px)" },
  { value: "320", label: "Mobile (320px)" },
];

const PAGE_OPTIONS: { value: HtmlPdfPageSize; label: string }[] = [
  { value: "a3", label: "A3 (297×420 mm)" },
  { value: "a4", label: "A4 (297×210 mm)" },
  { value: "a5", label: "A5 (148×210 mm)" },
  { value: "letter", label: "US Letter (216×279 mm)" },
];

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getPreviewWidth(screenSize: HtmlPdfScreenSize) {
  if (screenSize === "current") return "100%";
  return `${screenSize}px`;
}

function firstSrcFromSrcset(srcset: string) {
  return srcset
    .split(",")
    .map((entry) => entry.trim().split(/\s+/)[0])
    .find(Boolean);
}

function assetProxyUrl(value: string, baseUrl: string) {
  const raw = value.trim();
  if (!raw || /^(data:|blob:|#)/i.test(raw)) return value;
  try {
    const absolute = new URL(raw, baseUrl);
    if (!['http:', 'https:'].includes(absolute.protocol)) return value;
    return `/api/html-to-pdf/asset?url=${encodeURIComponent(absolute.toString())}`;
  } catch {
    return value;
  }
}

function proxiedSrcset(value: string, baseUrl: string) {
  return value.split(",").map((entry) => {
    const [url, ...descriptor] = entry.trim().split(/\s+/);
    return [assetProxyUrl(url, baseUrl), ...descriptor].join(" ");
  }).join(", ");
}

function proxyCssUrls(value: string, baseUrl: string) {
  return value.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (_match, _quote, url) => `url("${assetProxyUrl(url, baseUrl)}")`);
}

function preparePreviewHtml(source: Source, settings: HtmlPdfSettings) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source.html, "text/html");
  const baseUrl = source.kind === "url" ? source.finalUrl : undefined;

  if (baseUrl) {
    doc.querySelectorAll("base").forEach((node) => node.remove());
    const base = doc.createElement("base");
    base.href = baseUrl;
    doc.head.prepend(base);

    doc.querySelectorAll("link[rel~='stylesheet'][href]").forEach((node) => {
      const href = node.getAttribute("href");
      if (href) node.setAttribute("href", assetProxyUrl(href, baseUrl));
    });
    doc.querySelectorAll("style").forEach((node) => {
      node.textContent = proxyCssUrls(node.textContent ?? "", baseUrl);
    });
    doc.querySelectorAll<HTMLElement>("[style]").forEach((node) => {
      const inlineStyle = node.getAttribute("style");
      if (inlineStyle) node.setAttribute("style", proxyCssUrls(inlineStyle, baseUrl));
    });
  }

  doc.querySelectorAll("img, source").forEach((node) => {
    const element = node as HTMLImageElement | HTMLSourceElement;
    const lazySrc = element.getAttribute("data-src") || element.getAttribute("data-original") || element.getAttribute("data-lazy-src");
    const lazySrcset = element.getAttribute("data-srcset") || element.getAttribute("data-lazy-srcset");
    const currentSrc = element.getAttribute("src");

    if (lazySrcset && !element.getAttribute("srcset")) {
      element.setAttribute("srcset", lazySrcset);
    }

    if (lazySrc && (!currentSrc || currentSrc.startsWith("data:image") || currentSrc === "#")) {
      element.setAttribute("src", lazySrc);
    } else if (!currentSrc && lazySrcset) {
      const firstSrc = firstSrcFromSrcset(lazySrcset);
      if (firstSrc) element.setAttribute("src", firstSrc);
    }

    element.removeAttribute("loading");
    if (baseUrl) {
      const src = element.getAttribute("src");
      const srcset = element.getAttribute("srcset");
      if (src) element.setAttribute("src", assetProxyUrl(src, baseUrl));
      if (srcset) element.setAttribute("srcset", proxiedSrcset(srcset, baseUrl));
    }
  });

  if (settings.blockAds) {
    doc
      .querySelectorAll(
        [
          "iframe",
          "[id*='ad' i]",
          "[class*='ad-' i]",
          "[class*='ads' i]",
          "[class*='advert' i]",
          "[aria-label*='advert' i]",
          "[data-ad]",
        ].join(",")
      )
      .forEach((node) => node.remove());
  }

  if (settings.removeOverlays) {
    doc
      .querySelectorAll(
        [
          "[class*='modal' i]",
          "[class*='popup' i]",
          "[class*='overlay' i]",
          "[class*='cookie' i]",
          "[id*='modal' i]",
          "[id*='popup' i]",
          "[id*='overlay' i]",
          "[role='dialog']",
        ].join(",")
      )
      .forEach((node) => node.remove());
  }

  const style = doc.createElement("style");
  style.textContent = `
    html { background: #fff; }
    body { min-height: 100vh; }
    a[href^="#"], .skip-link, .visually-hidden:not(:focus):not(:active) {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }
    img { max-width: 100%; }
  `;
  doc.head.append(style);

  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

function Modal({
  open,
  onClose,
  onUrl,
  onFile,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onUrl: (url: string) => void;
  onFile: (file: File) => void;
  loading: boolean;
}) {
  const [tab, setTab] = useState<ModalTab>("url");
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-950">
        <div className="relative px-6 pb-5 pt-8 text-center md:px-10">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={loading}
            className="absolute right-5 top-5 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Add HTML to convert from</h2>
          <p className="mt-2 text-sm text-slate-500">Paste a website URL or upload an HTML file from your device.</p>
        </div>

        <div className="px-6 md:px-10">
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTab("url")}
              className={cn("border-b-2 px-5 py-3 text-sm font-semibold transition", tab === "url" ? "border-amber-500 text-slate-950 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white")}
            >
              Url
            </button>
            <button
              type="button"
              onClick={() => setTab("file")}
              className={cn("border-b-2 px-5 py-3 text-sm font-semibold transition", tab === "file" ? "border-amber-500 text-slate-950 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white")}
            >
              HTML file
            </button>
          </div>

          {tab === "url" ? (
            <form
              className="py-8"
              onSubmit={(event) => {
                event.preventDefault();
                onUrl(normalizeUrl(url));
              }}
            >
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-100" htmlFor="html-url">
                Website URL
              </label>
              <div className="mt-2 flex h-12 items-center rounded-lg border border-slate-300 bg-white px-3.5 transition focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/15 dark:border-slate-700 dark:bg-slate-900">
                <Globe2 className="mr-2.5 h-4.5 w-4.5 shrink-0 text-slate-400" />
                <input
                  id="html-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="Example: https://example.com"
                  disabled={loading}
                  className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </form>
          ) : (
            <div className="py-8">
              <input
                ref={fileRef}
                type="file"
                accept=".html,.htm,text/html"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onFile(file);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => fileRef.current?.click()}
                className="flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition hover:border-amber-300 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                  <Upload className="h-6 w-6" />
                </span>
                <span className="mt-3 text-base font-semibold text-slate-900 dark:text-white">Select HTML file</span>
                <span className="mt-1 text-sm text-slate-500">.html or .htm, up to 100MB</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/70 md:px-10">
          <Button
            disabled={loading}
            onClick={() => (tab === "url" ? onUrl(normalizeUrl(url)) : fileRef.current?.click())}
            className="min-w-24 bg-slate-950 font-semibold hover:bg-amber-500 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
          >
            {loading ? "Adding…" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InitialLanding({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      className="flex flex-1 py-10 dark:bg-slate-950/50 md:py-14"
      style={{ backgroundImage: "radial-gradient(circle at 50% 18%, rgba(251,191,36,0.13), transparent 34%), linear-gradient(to bottom, #f8fafc, #ffffff)" }}
    >
      <div className="container mx-auto flex max-w-5xl flex-1 flex-col px-4">
        <BackToHome />
        <section className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
          <div className={cn("mb-5 flex h-16 w-16 items-center justify-center rounded-2xl", landingStyle.bgClass)}>
            <Code2 className={cn("h-8 w-8", landingStyle.iconClass)} aria-hidden />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white md:text-5xl">HTML to PDF</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">
            Convert web pages or local HTML files to PDF documents with clean, readable output.
          </p>
          <div className="mt-9 w-full max-w-xl rounded-3xl border-2 border-dashed border-slate-200 bg-white p-5 shadow-[0_22px_70px_-46px_rgba(15,23,42,0.55)] transition hover:border-amber-400 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl bg-slate-50 px-5 py-8 dark:bg-slate-950/60">
              <button
                type="button"
                onClick={onOpen}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-slate-950 px-7 py-4 text-base font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 motion-reduce:hover:translate-y-0 dark:bg-amber-500 dark:text-slate-950 md:text-lg"
              >
                <Code2 className="h-5 w-5" aria-hidden />
                Add HTML
              </button>
              <span className="mt-4 text-sm text-slate-500">add a website URL or upload an HTML file</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span>No account needed</span>
            <span>URL or local HTML file</span>
            <span>Up to 100MB per file</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function OptionCard({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
        active
          ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          : "border-slate-200 text-slate-500 hover:border-amber-300 dark:border-slate-700"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SettingsPanel({
  source,
  settings,
  setSettings,
  onRefresh,
  onPreview,
  onConvert,
  loading,
  processing,
  progress,
}: {
  source: Source;
  settings: HtmlPdfSettings;
  setSettings: (next: HtmlPdfSettings) => void;
  onRefresh: () => void;
  onPreview: () => void;
  onConvert: () => void;
  loading: boolean;
  processing: boolean;
  progress: number;
}) {
  const patch = (partial: Partial<HtmlPdfSettings>) => setSettings({ ...settings, ...partial });
  return (
    <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[560px] lg:p-6">
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-5 flex shrink-0 items-center gap-3 border-b pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400">
            <Code2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">HTML to PDF settings</h2>
            <p className="text-xs text-slate-500">Preview updates as you choose</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">{source.kind === "url" ? "Website URL" : "HTML file"}</label>
            <div className="flex h-11 overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="flex min-w-0 flex-1 items-center gap-2 px-3 text-slate-600 dark:text-slate-300">
                {source.kind === "url" ? <Globe2 className="h-4 w-4 shrink-0" /> : <FileCode className="h-4 w-4 shrink-0" />}
                <span className="truncate text-sm">{source.kind === "url" ? source.url : source.file.name}</span>
              </div>
              {source.kind === "url" && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading || processing}
                  aria-label="Refresh URL"
                  className="flex w-11 shrink-0 items-center justify-center border-l border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">Screen size</label>
            <div className="relative">
              <select value={settings.screenSize} onChange={(event) => patch({ screenSize: event.target.value as HtmlPdfScreenSize })} className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3.5 pr-9 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 dark:border-slate-700 dark:bg-slate-900">
                {SCREEN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4.5 w-4.5 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">Page size</label>
            <div className="relative">
              <select value={settings.pageSize} onChange={(event) => patch({ pageSize: event.target.value as HtmlPdfPageSize })} className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3.5 pr-9 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 dark:border-slate-700 dark:bg-slate-900">
                {PAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4.5 w-4.5 text-slate-400" />
            </div>
            <label className="mt-3 flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={settings.oneLongPage} onChange={(event) => patch({ oneLongPage: event.target.checked })} className="h-4.5 w-4.5 rounded border-slate-300 accent-amber-500" />
              <span>One long page</span>
              <span className="group relative inline-flex">
                <Info className="h-4 w-4 text-slate-400" />
                <span className="pointer-events-none absolute -left-28 bottom-6 z-20 w-64 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                  Converts the page into one long PDF page instead of splitting it into several PDF pages.
                </span>
              </span>
            </label>
          </div>

          <div>
            <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">Orientation</p>
            <div className="grid grid-cols-2 gap-2.5" role="tablist" aria-label="Orientation">
              <OptionCard active={settings.orientation === "portrait"} label="Portrait" icon={<Smartphone className="h-5 w-5" />} onClick={() => patch({ orientation: "portrait" })} />
              <OptionCard active={settings.orientation === "landscape"} label="Landscape" icon={<Monitor className="h-5 w-5" />} onClick={() => patch({ orientation: "landscape" })} />
            </div>
          </div>

          <div>
            <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">Page margin</p>
            <div className="grid grid-cols-3 gap-2.5" role="tablist" aria-label="Page margin">
              {(["none", "small", "big"] as HtmlPdfMargin[]).map((margin) => (
                <OptionCard
                  key={margin}
                  active={settings.margin === margin}
                  label={margin === "none" ? "No margin" : margin === "small" ? "Small" : "Big"}
                  icon={<FileOutput className="h-5 w-5" />}
                  onClick={() => patch({ margin })}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">HTML settings</p>
            <label className="mb-2.5 flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={settings.blockAds} onChange={(event) => patch({ blockAds: event.target.checked })} className="h-4.5 w-4.5 rounded border-slate-300 accent-amber-500" />
              Try to block ads
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={settings.removeOverlays} onChange={(event) => patch({ removeOverlays: event.target.checked })} className="h-4.5 w-4.5 rounded border-slate-300 accent-amber-500" />
              Remove overlay popups
              <span className="group relative inline-flex">
                <Info className="h-4 w-4 text-slate-400" />
                <span className="pointer-events-none absolute -left-28 bottom-6 z-20 w-64 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                  Tries to remove cookie banners, modals, and popup overlays before converting.
                </span>
              </span>
            </label>
          </div>
        </div>

        {processing ? (
          <div className="mt-5 shrink-0">
            <ProcessingState progress={progress} label="Converting HTML to PDF…" cancelable={false} />
          </div>
        ) : (
          <div className="mt-5 shrink-0 space-y-2.5">
            <Button variant="outline" onClick={onPreview} disabled={loading || processing} className="h-11 w-full">
              Preview <Eye className="ml-2 h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={onConvert}
              disabled={loading || processing}
              className="flex min-h-16 w-full items-center justify-center rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0 dark:bg-amber-500 dark:text-slate-950"
            >
              Convert to PDF
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function Workspace({
  source,
  settings,
  setSettings,
  onClear,
  onRefresh,
  onPreview,
  onConvert,
  loading,
  processing,
  progress,
  frameRef,
}: {
  source: Source;
  settings: HtmlPdfSettings;
  setSettings: (next: HtmlPdfSettings) => void;
  onClear: () => void;
  onRefresh: () => void;
  onPreview: () => void;
  onConvert: () => void;
  loading: boolean;
  processing: boolean;
  progress: number;
  frameRef: RefObject<HTMLIFrameElement | null>;
}) {
  const width = getPreviewWidth(settings.screenSize);
  const previewHtml = useMemo(() => preparePreviewHtml(source, settings), [source, settings]);
  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50">
      <PdfWorkspaceBar
        title="HTML to PDF"
        meta={source.kind === "url" ? source.finalUrl : `${source.file.name} · ${formatFileSize(source.file.size)}`}
        actions={
          <Button variant="ghost" size="sm" onClick={onClear} disabled={processing || loading}>
            Start over
          </Button>
        }
      />
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="relative min-h-[560px] overflow-y-auto border-b p-5 lg:h-[calc(100vh-8.15rem)] lg:border-b-0 lg:border-r lg:p-8">
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/85 dark:bg-slate-950/85">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" aria-hidden />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Loading preview…</p>
            </div>
          )}
          <div className="mx-auto min-h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all dark:border-slate-800" style={{ width, maxWidth: "100%" }}>
            <iframe
              ref={frameRef}
              title="HTML preview"
              sandbox="allow-same-origin"
              srcDoc={previewHtml}
              className="h-[calc(100vh-13rem)] min-h-[480px] w-full bg-white"
            />
          </div>
        </section>
        <SettingsPanel source={source} settings={settings} setSettings={setSettings} onRefresh={onRefresh} onPreview={onPreview} onConvert={onConvert} loading={loading} processing={processing} progress={progress} />
      </div>
    </div>
  );
}

export function HtmlToPdfClient() {
  const [modalOpen, setModalOpen] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [settings, setSettings] = useState<HtmlPdfSettings>({
    screenSize: "current",
    pageSize: "a4",
    orientation: "portrait",
    oneLongPage: true,
    margin: "none",
    blockAds: false,
    removeOverlays: false,
  });
  const autoDownloadedRef = useRef(false);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const { processing, progress, run } = useProcessingTask();

  const loadUrl = useCallback(async (url: string) => {
    if (!url) {
      toast.error("Please enter a website URL.");
      return;
    }
    setLoadingSource(true);
    try {
      const response = await fetch("/api/html-to-pdf/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as { html?: string; finalUrl?: string; error?: string };
      if (!response.ok || !payload.html) throw new Error(payload.error || "Could not load this URL.");
      const parsed = new URL(payload.finalUrl || url);
      setSource({ kind: "url", url, finalUrl: payload.finalUrl || url, html: payload.html, name: parsed.hostname.replace(/^www\./, "") || "website" });
      setResult(null);
      setModalOpen(false);
      toast.success("Preview is ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load this URL.");
    } finally {
      setLoadingSource(false);
    }
  }, []);

  const loadFile = useCallback(async (file: File) => {
    if (!/\.(html?|xhtml)$/i.test(file.name) && file.type && file.type !== "text/html") {
      toast.error("Please choose an HTML file.");
      return;
    }
    if (file.size > MAX_HTML_FILE_SIZE) {
      toast.error("HTML files must be 100MB or smaller.");
      return;
    }
    setLoadingSource(true);
    try {
      const html = await file.text();
      setSource({ kind: "file", file, html, name: safeBaseName(file.name) || "html-file" });
      setResult(null);
      setModalOpen(false);
      toast.success("HTML file added.");
    } catch {
      toast.error("Could not read this HTML file.");
    } finally {
      setLoadingSource(false);
    }
  }, []);

  const convert = () => {
    if (!source) return;
    run(
      async (setProgress) => {
        setResult(null);
        autoDownloadedRef.current = false;
        const frameDocument = previewFrameRef.current?.contentDocument;
        const captureTarget = frameDocument?.body;
        let blob: Blob;
        if (captureTarget) {
          await frameDocument.fonts?.ready;
          const pendingImages = Array.from(frameDocument.images).filter((image) => !image.complete).map((image) => new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }));
          if (pendingImages.length) await Promise.race([Promise.all(pendingImages), new Promise((resolve) => setTimeout(resolve, 5000))]);
          blob = await captureHtmlElementToPdfBlob(captureTarget, settings, setProgress);
        } else {
          blob = await convertHtmlToPdfBlob(source.html, settings, {
            sourceLabel: source.kind === "url" ? source.finalUrl : source.file.name,
            onProgress: setProgress,
          });
        }
        setResult({ blob, filename: `${source.name}.pdf` });
      },
      {
        successMessage: "HTML converted to PDF.",
        toolName: "html-to-pdf",
        errorTitle: "Couldn’t convert this HTML",
        onError: (error) => (error instanceof Error ? error.message : "Please try again with valid HTML."),
      }
    );
  };

  const download = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);

  if (result) {
    return (
      <PdfToolResultLayout toolSlug="html-to-pdf">
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={download}
          onStartOver={() => {
            setSource(null);
            setResult(null);
          }}
          autoDownloadedRef={autoDownloadedRef}
          downloadLabel="Download PDF again"
        />
        <div className="mx-auto mt-2 max-w-2xl rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-6 text-slate-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-slate-200">
          <div className="mb-2 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Check className="h-5 w-5 text-emerald-600" /> Secure, private, in your control
          </div>
          Local HTML files are processed in your browser. Website URL mode imports the public HTML first, then creates the PDF and starts the download automatically.
        </div>
      </PdfToolResultLayout>
    );
  }

  return (
    <>
      {!source ? (
        <InitialLanding onOpen={() => setModalOpen(true)} />
      ) : (
        <Workspace
          source={source}
          settings={settings}
          setSettings={setSettings}
          onClear={() => setSource(null)}
          onRefresh={() => source.kind === "url" && loadUrl(source.url)}
          onPreview={() => toast.success("Preview refreshed with the current settings.")}
          onConvert={convert}
          loading={loadingSource}
          processing={processing}
          progress={progress}
          frameRef={previewFrameRef}
        />
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} onUrl={loadUrl} onFile={loadFile} loading={loadingSource} />
    </>
  );
}
