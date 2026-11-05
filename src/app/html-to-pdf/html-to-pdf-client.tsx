"use client";
import { CloudImportButtons } from "@/components/tool/CloudImportButtons";

import { UiText, useToolCopy } from "@/components/i18n/UiText";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
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
  type HtmlPdfMargin,
  type HtmlPdfPageSize,
  type HtmlPdfScreenSize,
  type HtmlPdfSettings,
} from "@/lib/engines/html-to-pdf-engine";
import { captureHtmlElementToImage, type HtmlImageSettings, type HtmlImageFormat } from "@/lib/engines/html-to-image-engine";
import { htmlSourceBase, htmlSourceLink } from "@/lib/engines/html-source-links";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getCategoryStyle } from "@/lib/category-colors";
import { getTool } from "@/lib/tools";
import { cn, formatFileSize } from "@/lib/utils";

const MAX_HTML_FILE_SIZE = 100 * 1024 * 1024;
type OutputMode = "pdf" | "image";
const titleFor = (mode: OutputMode) => mode === "image" ? "HTML to Image" : "HTML to PDF";

type Source =
  | { kind: "url"; url: string; finalUrl: string; html: string; name: string }
  | { kind: "file"; file: File; html: string; name: string; pages?: { label: string; html: string }[]; selectedPage?: number };

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
  { value: "a4", label: "A4 (210×297 mm)" },
  { value: "a5", label: "A5 (148×210 mm)" },
  { value: "letter", label: "US Letter (216×279 mm)" },
];

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
    return `${window.location.origin}/api/html-to-pdf/asset?url=${encodeURIComponent(absolute.toString())}`;
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

function preparePreviewHtml(source: Source, settings: Pick<HtmlPdfSettings, "blockAds" | "removeOverlays">) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source.html, "text/html");
  const baseUrl = htmlSourceBase(source.kind === "url" ? source.finalUrl : undefined, doc.querySelector("base[href]")?.getAttribute("href"));
  // Never execute imported scripts in the application's origin.
  doc.querySelectorAll("script, iframe, object, embed, meta[http-equiv='refresh' i]").forEach(node => node.remove());
  doc.querySelectorAll("*").forEach(node => Array.from(node.attributes).forEach(attr => {
    if (/^on/i.test(attr.name) || ["action", "formaction", "srcdoc"].includes(attr.name)) node.removeAttribute(attr.name);
  }));

  doc.querySelectorAll("base").forEach(node => node.remove());
  doc.querySelectorAll("a[href],area[href]").forEach(node => {
    const href = htmlSourceLink(node.getAttribute("href") ?? "", baseUrl);
    if (href) node.setAttribute("href", href);
    else node.removeAttribute("href");
  });

  if (baseUrl) {

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
    // Local HTML cannot resolve sibling files through this website. Mark the
    // missing image immediately rather than requesting an unrelated app route.
    if (!baseUrl) {
      for (const attribute of ["src", "srcset"]) {
        const value = element.getAttribute(attribute);
        if (value && !/^(data:|blob:|https?:|\/\/)/i.test(value)) element.setAttribute(attribute, "data:image/png;base64,");
      }
    }
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
          "[id^='ad-']",
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
    .skip-link, .visually-hidden:not(:focus):not(:active) {
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
  error,
}: {
  open: boolean;
  onClose: () => void;
  onUrl: (url: string) => void;
  onFile: (file: File) => void;
  loading: boolean;
  error: string;
}) {
  const [tab, setTab] = useState<ModalTab>("url");
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("input:not([type='file']),button")?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab" || !dialog) return;
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled):not([type='file']),select:not(:disabled),a[href]")).filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keys);
    return () => { document.removeEventListener("keydown", keys); previous?.focus(); };
  }, [open, onClose]);
  if (!open) return null;

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Add HTML" data-clarity-mask="True">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-950">
        <div className="relative px-6 pb-5 pt-8 text-center md:px-10">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
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
                <UiText text="Website URL" />
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
                accept=".html,.htm,.xhtml,text/html,application/xhtml+xml"
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
                <span className="mt-3 text-base font-semibold text-slate-900 dark:text-white"><UiText text="Select HTML file" /></span>
                <span className="mt-1 text-sm text-slate-500">.html or .htm, up to 100MB</span>
              </button>
            </div>
          )}
        </div>

        {error && <p role="alert" className="mx-6 mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
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

function InitialLanding({ onOpen, onFiles, mode }: { onOpen: () => void; onFiles: (files: File[]) => void; mode: OutputMode }) {
  const landingStyle = getCategoryStyle(getTool(mode === "image" ? "/html-to-image" : "/html-to-pdf")!);
  const copy = useToolCopy();
  return (
    <div
      className="pdf-tool-landing flex flex-1 py-10 md:py-14"
    >
      <div className="container mx-auto flex max-w-5xl flex-1 flex-col px-4">
        <BackToHome />
        <section className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
          <div className={cn("mb-5 flex h-16 w-16 items-center justify-center rounded-2xl", landingStyle.bgClass)}>
            <Code2 className={cn("h-8 w-8", landingStyle.iconClass)} aria-hidden />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white md:text-5xl">{copy.title(titleFor(mode))}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">
            {copy.description(mode === "image" ? "Save a public web page or local HTML file as PNG, JPG, WEBP or SVG. Preview the page, choose its size, then download your image." : "Convert web pages or local HTML files to PDF documents with clean, readable output.")}
          </p>
          <div className="mt-9 w-full max-w-xl rounded-3xl border-2 border-dashed border-slate-200 bg-white p-5 shadow-[0_22px_70px_-46px_rgba(15,23,42,0.55)] transition hover:border-amber-400 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl bg-slate-50 px-5 py-8 dark:bg-slate-950/60">
              <CloudImportButtons accept={{ "text/html": [".html", ".htm", ".xhtml"] }} onFilesSelected={onFiles}>
              <button
                type="button"
                onClick={onOpen}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-slate-950 px-7 py-4 text-base font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 motion-reduce:hover:translate-y-0 dark:bg-amber-500 dark:text-slate-950 md:text-lg"
              >
                <Code2 className="h-5 w-5" aria-hidden />
                <UiText text="Add HTML" />
              </button>
              </CloudImportButtons>
              <span className="mt-4 text-sm text-slate-500">{copy.locale === "en" ? "add a website URL or upload an HTML file" : `${copy.t("Website URL")} / ${copy.t("Select HTML file")}`}</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span><UiText text="No account needed" /></span>
            <span>URL or local HTML file</span>
            <span><UiText text="Up to 100MB per file" /></span>
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
  mode, imageSettings, setImageSettings, onCancel, error,
  previewReady,
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
  mode: OutputMode;
  imageSettings: HtmlImageSettings;
  setImageSettings: (value: HtmlImageSettings) => void;
  onCancel: () => void;
  error: string;
  previewReady: boolean;
}) {
  const patch = (partial: Partial<HtmlPdfSettings>) => setSettings({ ...settings, ...partial });
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!error || !errorRef.current) return;
    errorRef.current.scrollIntoView({ block: "nearest", behavior: "instant" });
    errorRef.current.focus({ preventScroll: true });
  }, [error]);
  return (
    <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-8.15rem)] lg:min-h-[560px] lg:p-6">
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-5 flex shrink-0 items-center gap-3 border-b pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400">
            <Code2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">{titleFor(mode)} settings</h2>
            <p className="text-xs text-slate-500"><UiText text="Preview updates as you choose" /></p>
          </div>
        </div>

        <fieldset disabled={processing} className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
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
              <select aria-label="Screen size" value={settings.screenSize} onChange={(event) => patch({ screenSize: event.target.value as HtmlPdfScreenSize })} className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3.5 pr-9 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 dark:border-slate-700 dark:bg-slate-900">
                {SCREEN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4.5 w-4.5 text-slate-400" />
            </div>
          </div>

          {mode === "pdf" ? <>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100"><UiText text="Page size" /></label>
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
            <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100"><UiText text="Orientation" /></p>
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

          </> : <div className="space-y-4">
            <label className="block text-sm font-semibold">Image format
              <select className="mt-2 block h-11 w-full rounded-lg border bg-white px-3 dark:bg-slate-900" value={imageSettings.format} onChange={event => setImageSettings({ ...imageSettings, format: event.target.value as HtmlImageFormat })}>
                <option value="png">PNG — lossless</option><option value="jpg">JPG — smaller file</option><option value="webp">WEBP</option><option value="svg">SVG — browser view</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">Capture area
              <select className="mt-2 block h-11 w-full rounded-lg border bg-white px-3 dark:bg-slate-900" value={imageSettings.area} onChange={event => setImageSettings({ ...imageSettings, area: event.target.value as HtmlImageSettings["area"] })}>
                <option value="full">Full page</option><option value="viewport">First screen only</option>
              </select>
            </label>
            {imageSettings.format !== "svg" && <label className="block text-sm font-semibold">Image resolution
              <select className="mt-2 block h-11 w-full rounded-lg border bg-white px-3 dark:bg-slate-900" value={imageSettings.scale} onChange={event => setImageSettings({ ...imageSettings, scale: Number(event.target.value) as 1 | 2 })}>
                <option value="1">1× — original pixels</option><option value="2">2× — sharper image</option>
              </select>
            </label>}
            {["jpg", "webp"].includes(imageSettings.format) && <label className="block text-sm font-semibold">Quality: {Math.round(imageSettings.quality * 100)}%
              <input aria-label="Image quality" className="mt-3 block w-full accent-amber-500" type="range" min="10" max="100" value={Math.round(imageSettings.quality * 100)} onChange={event => setImageSettings({ ...imageSettings, quality: Number(event.target.value) / 100 })} />
            </label>}
            {imageSettings.format === "svg" && <p className="text-xs leading-5 text-slate-500">SVG keeps text and HTML layout using foreignObject. Open it in a modern browser. Some design editors do not support this format; use PNG for universal image viewing.</p>}
            <p className="text-xs leading-5 text-slate-500">Up to 32 megapixels and 16,384 pixels per side. Very tall pages may need a smaller screen size or the first screen only.</p>
          </div>}

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
        </fieldset>

        {error && <p ref={errorRef} role="alert" tabIndex={-1} className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
        {processing ? (
          <div className="mt-5 shrink-0">
            <ProcessingState progress={progress} label={mode === "image" ? "Creating your image…" : "Converting HTML to PDF…"} cancelable onCancel={onCancel} />
          </div>
        ) : (
          <div className="mt-5 shrink-0 space-y-2.5">
            <Button variant="outline" onClick={onPreview} disabled={loading || processing} className="h-11 w-full">
              Preview <Eye className="ml-2 h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={onConvert}
              disabled={loading || processing || !previewReady}
              className="flex min-h-16 w-full items-center justify-center rounded-xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0 dark:bg-amber-500 dark:text-slate-950"
            >
              {mode === "image" ? "Convert to image" : <UiText text="Convert to PDF" />}
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
  mode, imageSettings, setImageSettings, onCancel, error,
  frameRef,
  onSelectPage,
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
  mode: OutputMode;
  imageSettings: HtmlImageSettings;
  setImageSettings: (value: HtmlImageSettings) => void;
  onCancel: () => void;
  error: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
  onSelectPage: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ available: 800, width: 1440, height: 900 });
  const [loadedPreview, setLoadedPreview] = useState<object | null>(null);
  const [previewTimedOut, setPreviewTimedOut] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  useEffect(() => {
    const update = () => setDimensions({ available: containerRef.current?.clientWidth || 800, width: window.innerWidth, height: window.innerHeight });
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", update); update();
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, []);
  const width = settings.screenSize === "current" ? dimensions.width : Number(settings.screenSize);
  const scale = Math.min(1, dimensions.available / width);
  const { blockAds, removeOverlays } = settings;
  const preview = useMemo(() => ({ html: preparePreviewHtml(source, { blockAds, removeOverlays }), revision: previewRevision }), [source, blockAds, removeOverlays, previewRevision]);
  const frameReady = loadedPreview === preview;
  useEffect(() => {
    setPreviewTimedOut(false);
    if (frameReady) return;
    const timer = setTimeout(() => setPreviewTimedOut(true), 20_000);
    return () => clearTimeout(timer);
  }, [preview, frameReady]);
  return (
    <div className="flex-1 bg-slate-100/75 dark:bg-slate-950/50" data-clarity-mask="True">
      <PdfWorkspaceBar
        title={titleFor(mode)}
        meta={source.kind === "url" ? source.finalUrl : `${source.file.name} · ${formatFileSize(source.file.size)}`}
        actions={
          <Button variant="ghost" size="sm" onClick={onClear} disabled={processing || loading}>
            <UiText text="Start over" />
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
          {source.kind === "file" && source.pages && <label className="mb-4 block text-sm font-medium">Page in this HTML file
            <select className="mt-2 block w-full rounded-lg border bg-white p-3 text-slate-900" value={source.selectedPage || 0} disabled={processing} onChange={event => onSelectPage(Number(event.target.value))}>
              {source.pages.map((page, index) => <option key={index} value={index}>{page.label}</option>)}
            </select>
          </label>}
          <div ref={containerRef} className="mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800" style={{ height: Math.max(1, dimensions.height * scale) }}>
            <iframe
              key={previewRevision}
              ref={frameRef}
              title="HTML preview"
              sandbox="allow-same-origin"
              srcDoc={preview.html}
              onLoad={() => setLoadedPreview(preview)}
              style={{ width, height: dimensions.height, transform: `scale(${scale})`, transformOrigin: "top left", border: 0 }}
              className="bg-white"
            />
          </div>
        </section>
        <SettingsPanel source={source} settings={settings} setSettings={setSettings} onRefresh={onRefresh} onPreview={() => { setPreviewRevision(value => value + 1); onPreview(); }} onConvert={onConvert} loading={loading} previewReady={frameReady} processing={processing} progress={progress} mode={mode} imageSettings={imageSettings} setImageSettings={setImageSettings} onCancel={onCancel} error={error || (previewTimedOut ? "The preview has not finished loading. Press Preview to retry, or start over with a self-contained HTML file." : "")} />
      </div>
    </div>
  );
}

export function HtmlToPdfClient() { return <HtmlConvertClient mode="pdf" />; }

export function HtmlConvertClient({ mode }: { mode: OutputMode }) {
  const toolSlug = mode === "image" ? "html-to-image" : "html-to-pdf";
  const [imageSettings, setImageSettings] = useState<HtmlImageSettings>({ format: "png", scale: 1, area: "full", quality: 0.9 });
  const [error, setError] = useState("");
  const captureAbort = useRef<AbortController | null>(null);
  const captureBusy = useRef(false);
  const [capturing, setCapturing] = useState(false);
  const sourceAbort = useRef<AbortController | null>(null);
  const sourceGeneration = useRef(0);
  useEffect(() => () => { captureAbort.current?.abort(); sourceAbort.current?.abort(); sourceGeneration.current++; }, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; filename: string; width?: number; height?: number } | null>(null);
  const [resultPreview, setResultPreview] = useState("");
  useEffect(() => { if (result) window.scrollTo({ top: 0, behavior: "instant" }); }, [result]);
  useEffect(() => {
    if (!result || mode !== "image") { setResultPreview(""); return; }
    const url = URL.createObjectURL(result.blob); setResultPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [result, mode]);
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
  const { processing, progress, run, cancel } = useProcessingTask();
  const closeModal = useCallback(() => {
    sourceGeneration.current++; sourceAbort.current?.abort(); setLoadingSource(false); setModalOpen(false);
  }, []);

  const loadUrl = useCallback(async (url: string) => {
    const generation = ++sourceGeneration.current;
    sourceAbort.current?.abort();
    const controller = new AbortController(); sourceAbort.current = controller;
    setError("");
    if (!url) {
      setError("Please enter a website URL.");
      toast.error("Please enter a website URL.");
      return;
    }
    setLoadingSource(true);
    try {
      const response = await fetch("/api/html-to-pdf/fetch", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as { html?: string; finalUrl?: string; error?: string };
      if (!response.ok || !payload.html) throw new Error(payload.error || "Could not load this URL.");
      if (generation !== sourceGeneration.current) return;
      const parsed = new URL(payload.finalUrl || url);
      setSource({ kind: "url", url, finalUrl: payload.finalUrl || url, html: payload.html, name: parsed.hostname.replace(/^www\./, "") || "website" });
      setResult(null);
      setModalOpen(false);
      toast.success("Preview is ready.");
    } catch (error) {
      if (generation !== sourceGeneration.current) return;
      const message = error instanceof Error ? error.message : "Could not load this URL."; setError(message); toast.error(message);
    } finally {
      if (generation === sourceGeneration.current) setLoadingSource(false);
    }
  }, []);

  const loadFile = useCallback(async (file: File) => {
    const generation = ++sourceGeneration.current; sourceAbort.current?.abort(); setError("");
    if (!/\.(html?|xhtml)$/i.test(file.name) && !["text/html", "application/xhtml+xml"].includes(file.type)) {
      setError("Please choose an HTML file.");
      toast.error("Please choose an HTML file.");
      return;
    }
    if (file.size > MAX_HTML_FILE_SIZE) {
      setError("HTML files must be 100MB or smaller.");
      toast.error("HTML files must be 100MB or smaller.");
      return;
    }
    setLoadingSource(true);
    try {
      const html = await file.text();
      // Embedded template bundles contain ready-made HTML documents as JSON.
      // Read that data without enabling or evaluating their JavaScript wrapper.
      const parsed = new DOMParser().parseFromString(html, "text/html");
      let pages: { label: string; html: string }[] | undefined;
      for (const data of Array.from(parsed.querySelectorAll('script[type="application/json"]'))) {
        try {
          const value = JSON.parse(data.textContent || "null");
          if (Array.isArray(value) && value.length && value.length <= 100 && value.every(page => typeof page?.html === "string" && typeof page?.label === "string")) { pages = value; break; }
        } catch { /* Other embedded data does not define HTML pages. */ }
      }
      if (!pages && parsed.querySelector("iframe:not([src]):not([srcdoc])") && parsed.querySelector("script:not([type='application/json'])")) {
        throw new Error("This HTML needs JavaScript to build its content. Please upload its standalone HTML page or a saved rendered page.");
      }
      if (!html.trim() || !parsed.body.textContent?.trim() && !parsed.body.querySelector(":not(script):not(style):not(link)")) throw new Error("This HTML file has no visible content. Upload a saved page with text or images.");
      if (generation !== sourceGeneration.current) return;
      setSource({ kind: "file", file, html: pages?.[0].html || html, pages, selectedPage: 0, name: safeBaseName(file.name.replace(/\.(html?|xhtml)$/i, "")) || "html-file" });
      setResult(null);
      setModalOpen(false);
      toast.success("HTML file added.");
    } catch (error) {
      if (generation !== sourceGeneration.current) return;
      const message = error instanceof Error ? error.message : "Could not read this HTML file."; setError(message); toast.error(message);
    } finally {
      if (generation === sourceGeneration.current) setLoadingSource(false);
    }
  }, []);

  const cancelCapture = () => { captureAbort.current?.abort(); cancel(); setError("Stopping conversion… Your page and settings are kept."); };
  const convert = () => {
    if (!source) return;
    if (captureBusy.current) { setError("Finishing the previous cancellation. Please try again in a moment."); return; }
    run(
      async (setProgress, isCancelled) => {
        captureBusy.current = true; setCapturing(true);
        const controller = new AbortController(); captureAbort.current = controller;
        setResult(null); setError(""); autoDownloadedRef.current = false;
        try {
          const captureTarget = previewFrameRef.current?.contentDocument?.body;
          if (!captureTarget) throw new Error("Please wait for the HTML preview to load, then try again.");
          if (mode === "image") {
            const output = await captureHtmlElementToImage(captureTarget, imageSettings, setProgress, controller.signal);
            if (!isCancelled() && !controller.signal.aborted) setResult({ ...output, filename: `${source.name}.${imageSettings.format}` });
          } else {
            const blob = await captureHtmlElementToPdfBlob(captureTarget, settings, setProgress, controller.signal);
            if (!isCancelled() && !controller.signal.aborted) setResult({ blob, filename: `${source.name}.pdf` });
          }
        } finally { captureBusy.current = false; setCapturing(false); if (controller.signal.aborted && isCancelled()) setError("Conversion stopped. Your page and settings are kept. You can try again."); }
      },
      {
        successMessage: mode === "image" ? "Your image is ready." : "HTML converted to PDF.",
        toolName: toolSlug,
        errorTitle: "Couldn’t convert this HTML",
        onError: error => { const message = error instanceof Error ? error.message : "Please try again with valid HTML."; setError(message); return "HTML conversion could not finish. Review the local error and retry."; },
      }
    );
  };

  const download = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);

  if (result) {
    return (
      <PdfToolResultLayout toolSlug={toolSlug} showTrust={false} showRelated={mode === "pdf"}>
        <div data-clarity-mask="True">
        <ResultState
          resultFilename={result.filename}
          fileSize={formatFileSize(result.blob.size)}
          onDownload={download}
          onStartOver={() => {
            setSource(null);
            setResult(null);
          }}
          autoDownloadedRef={autoDownloadedRef}
          downloadLabel={mode === "image" ? "Download image again" : "Download PDF again"}
        />
        <div className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-4">
          {result.width && <p className="text-sm text-slate-500">{result.width} × {result.height} pixels · {result.blob.type}</p>}
          <Button variant="outline" onClick={() => setResult(null)}>Adjust options</Button>
        </div>
        {resultPreview && <div className="mx-auto mt-5 max-w-2xl overflow-hidden rounded-xl border bg-white p-3">
          {/* This is the generated local image, including browser-rendered SVG. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultPreview} alt="Converted HTML image preview" className="mx-auto max-h-80 max-w-full object-contain" />
        </div>}
        <div className="mx-auto mt-2 max-w-2xl rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-6 text-slate-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-slate-200">
          <div className="mb-2 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Check className="h-5 w-5 text-emerald-600" /> Secure, private, in your control
          </div>
          {mode === "pdf" && <>PDF pages are image-based; text is not selectable or searchable. Safe clickable links are retained. </>}Local HTML is rendered in your browser. Public URLs and external assets are fetched through the website service. The download starts automatically. Imported scripts and embedded pages do not run; interactive websites may differ from their saved HTML.
        </div>
        </div>
      </PdfToolResultLayout>
    );
  }

  return (
    <>
      {!source ? (
        <InitialLanding mode={mode} onFiles={files => { if (files[0]) void loadFile(files[0]); }} onOpen={() => { setError(""); setModalOpen(true); }} />
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
          processing={processing || capturing}
          progress={progress}
          mode={mode} imageSettings={imageSettings} setImageSettings={setImageSettings} onCancel={cancelCapture} error={error}
          frameRef={previewFrameRef}
          onSelectPage={index => {
            if (source.kind === "file" && source.pages?.[index]) setSource({ ...source, html: source.pages[index].html, selectedPage: index });
          }}
        />
      )}
      {!source && error && <p role="alert" className="mx-auto mb-6 max-w-2xl rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <Modal open={modalOpen} onClose={closeModal} onUrl={loadUrl} onFile={loadFile} loading={loadingSource} error={error} />
    </>
  );
}
