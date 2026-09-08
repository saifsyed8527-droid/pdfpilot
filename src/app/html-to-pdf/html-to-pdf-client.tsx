"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Code2,
  Download,
  Eye,
  FileCode,
  FileOutput,
  Globe2,
  Info,
  Monitor,
  RefreshCw,
  Smartphone,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PdfToolResultLayout } from "@/components/tool/PdfToolChrome";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { downloadBlob } from "@/lib/download-file";
import {
  convertHtmlToPdfBlob,
  type HtmlPdfMargin,
  type HtmlPdfPageSize,
  type HtmlPdfScreenSize,
  type HtmlPdfSettings,
} from "@/lib/engines/html-to-pdf-engine";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import { cn, formatFileSize } from "@/lib/utils";

const MAX_HTML_FILE_SIZE = 100 * 1024 * 1024;

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

function preparePreviewHtml(source: Source, settings: HtmlPdfSettings) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source.html, "text/html");
  const baseUrl = source.kind === "url" ? source.finalUrl : undefined;

  if (baseUrl) {
    doc.querySelectorAll("base").forEach((node) => node.remove());
    const base = doc.createElement("base");
    base.href = baseUrl;
    doc.head.prepend(base);
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
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-950">
        <div className="relative px-6 pb-5 pt-8 text-center md:px-10">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={loading}
            className="absolute right-5 top-5 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Add HTML to convert from</h2>
          <p className="mt-2 text-sm text-slate-500">Paste a website URL or upload an HTML file from your device.</p>
        </div>

        <div className="px-6 md:px-10">
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTab("url")}
              className={cn("border-b-2 px-6 py-4 text-sm font-bold transition", tab === "url" ? "border-red-500 text-slate-950 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-900")}
            >
              Url
            </button>
            <button
              type="button"
              onClick={() => setTab("file")}
              className={cn("border-b-2 px-6 py-4 text-sm font-bold transition", tab === "file" ? "border-red-500 text-slate-950 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-900")}
            >
              HTML file
            </button>
          </div>

          {tab === "url" ? (
            <form
              className="py-9"
              onSubmit={(event) => {
                event.preventDefault();
                onUrl(normalizeUrl(url));
              }}
            >
              <label className="text-base font-bold text-slate-800 dark:text-slate-100" htmlFor="html-url">
                Write the website URL
              </label>
              <div className="mt-3 flex h-14 items-center rounded-lg border border-slate-300 bg-slate-50 px-4 transition focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/15 dark:border-slate-700 dark:bg-slate-900">
                <Globe2 className="mr-3 h-5 w-5 text-slate-400" />
                <input
                  id="html-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="Example: https://example.com"
                  disabled={loading}
                  className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
                />
              </div>
            </form>
          ) : (
            <div className="py-9">
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
                className="flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition hover:border-red-300 hover:bg-red-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                  <Upload className="h-7 w-7" />
                </span>
                <span className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Select HTML file</span>
                <span className="mt-2 text-sm text-slate-500">.html or .htm, up to 100MB</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/70 md:px-10">
          <Button
            size="lg"
            disabled={loading}
            onClick={() => (tab === "url" ? onUrl(normalizeUrl(url)) : fileRef.current?.click())}
            className="min-w-28 bg-red-600 font-bold hover:bg-red-700"
          >
            {loading ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InitialLanding({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex flex-1 bg-[#f7f7fb] py-10 dark:bg-slate-950 md:py-14">
      <div className="container mx-auto flex max-w-5xl flex-1 flex-col px-4">
        <Link href="/" className="mb-7 inline-flex w-fit items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
        <section className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-600">
            <Code2 className="h-9 w-9" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white">HTML to PDF</h1>
          <p className="mt-5 max-w-2xl text-xl leading-8 text-slate-600 dark:text-slate-300">
            Convert web pages or local HTML files to PDF documents with clean, readable output.
          </p>
          <Button onClick={onOpen} size="lg" className="mt-9 h-20 min-w-[280px] rounded-2xl bg-red-600 px-10 text-2xl font-bold shadow-xl shadow-red-600/20 hover:bg-red-700">
            Add HTML
          </Button>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
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
      onClick={onClick}
      className={cn(
        "flex min-h-28 flex-1 flex-col items-center justify-center rounded-xl border bg-slate-50 p-4 text-center text-slate-500 transition hover:bg-white",
        active ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-transparent dark:bg-slate-950/60"
      )}
    >
      {icon}
      <span className="mt-2 text-sm font-medium">{label}</span>
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
}: {
  source: Source;
  settings: HtmlPdfSettings;
  setSettings: (next: HtmlPdfSettings) => void;
  onRefresh: () => void;
  onPreview: () => void;
  onConvert: () => void;
  loading: boolean;
  processing: boolean;
}) {
  const patch = (partial: Partial<HtmlPdfSettings>) => setSettings({ ...settings, ...partial });
  return (
    <aside className="flex flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:h-[calc(100vh-76px)]">
      <div className="border-b border-slate-200 px-6 py-7 text-center dark:border-slate-800">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">HTML to PDF</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-800 dark:text-slate-100">{source.kind === "url" ? "Website Url" : "HTML file"}</label>
          <div className="flex h-12 overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex min-w-0 flex-1 items-center gap-2 px-3 text-slate-600 dark:text-slate-300">
              {source.kind === "url" ? <Globe2 className="h-5 w-5 shrink-0" /> : <FileCode className="h-5 w-5 shrink-0" />}
              <span className="truncate text-sm">{source.kind === "url" ? source.url : source.file.name}</span>
            </div>
            {source.kind === "url" && (
              <button type="button" onClick={onRefresh} disabled={loading || processing} className="flex w-12 items-center justify-center bg-red-600 text-white transition hover:bg-red-700 disabled:opacity-50" aria-label="Refresh URL">
                <RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-800 dark:text-slate-100">Screen size</label>
          <div className="relative">
            <select value={settings.screenSize} onChange={(event) => patch({ screenSize: event.target.value as HtmlPdfScreenSize })} className="h-12 w-full appearance-none rounded-lg border border-slate-300 bg-white px-4 pr-10 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/15 dark:border-slate-700 dark:bg-slate-900">
              {SCREEN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-slate-500" />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-800 dark:text-slate-100">Page size</label>
          <div className="relative">
            <select value={settings.pageSize} onChange={(event) => patch({ pageSize: event.target.value as HtmlPdfPageSize })} className="h-12 w-full appearance-none rounded-lg border border-slate-300 bg-white px-4 pr-10 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/15 dark:border-slate-700 dark:bg-slate-900">
              {PAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-slate-500" />
          </div>
          <label className="mt-3 flex items-center gap-3 text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={settings.oneLongPage} onChange={(event) => patch({ oneLongPage: event.target.checked })} className="h-6 w-6 rounded border-slate-300 accent-emerald-500" />
            <span>One long page</span>
            <span className="group relative">
              <Info className="h-4 w-4 text-red-500" />
              <span className="pointer-events-none absolute -left-28 bottom-6 z-20 w-64 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                Converts the page into one long PDF page instead of splitting it into several PDF pages.
              </span>
            </span>
          </label>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Orientation</p>
          <div className="grid grid-cols-2 gap-3">
            <OptionCard active={settings.orientation === "portrait"} label="Portrait" icon={<Smartphone className="h-7 w-7" />} onClick={() => patch({ orientation: "portrait" })} />
            <OptionCard active={settings.orientation === "landscape"} label="Landscape" icon={<Monitor className="h-7 w-7" />} onClick={() => patch({ orientation: "landscape" })} />
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Page margin</p>
          <div className="grid grid-cols-3 gap-3">
            {(["none", "small", "big"] as HtmlPdfMargin[]).map((margin) => (
              <OptionCard
                key={margin}
                active={settings.margin === margin}
                label={margin === "none" ? "No margin" : margin === "small" ? "Small" : "Big"}
                icon={<FileOutput className="h-7 w-7" />}
                onClick={() => patch({ margin })}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">HTML Settings</p>
          <label className="mb-3 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={settings.blockAds} onChange={(event) => patch({ blockAds: event.target.checked })} className="h-5 w-5 rounded border-slate-300 accent-emerald-500" />
            Try to block ads
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={settings.removeOverlays} onChange={(event) => patch({ removeOverlays: event.target.checked })} className="h-5 w-5 rounded border-slate-300 accent-emerald-500" />
            Remove overlay popups <Info className="h-4 w-4 text-red-500" />
          </label>
        </div>
      </div>
      <div className="space-y-4 border-t border-slate-200 p-6 dark:border-slate-800">
        <Button variant="outline" onClick={onPreview} disabled={loading || processing} className="h-12 w-full border-red-500 text-red-600 hover:bg-red-50">
          Preview <Eye className="ml-2 h-4 w-4" />
        </Button>
        <Button onClick={onConvert} disabled={loading || processing} className="h-20 w-full rounded-2xl bg-red-600 text-xl font-bold shadow-xl shadow-red-600/20 hover:bg-red-700">
          Convert to PDF <Download className="ml-3 h-6 w-6" />
        </Button>
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
}) {
  const width = getPreviewWidth(settings.screenSize);
  const previewHtml = useMemo(() => preparePreviewHtml(source, settings), [source, settings]);
  return (
    <div className="flex flex-1 flex-col bg-[#f7f7fb] dark:bg-slate-950">
      <div className="border-b bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="container mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">HTML to PDF</h1>
            <p className="truncate text-xs text-slate-500">{source.kind === "url" ? source.finalUrl : `${source.file.name} · ${formatFileSize(source.file.size)}`}</p>
          </div>
          <button type="button" onClick={onClear} disabled={processing || loading} className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white">
            Start over
          </button>
        </div>
      </div>
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_430px]">
        <section className="relative min-h-[560px] overflow-auto bg-slate-100 p-6 dark:bg-slate-900/50">
          {(loading || processing) && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/75 text-white">
              {processing ? (
                <ProcessingState progress={progress} label="Converting HTML to PDF..." />
              ) : (
                <>
                  <RefreshCw className="h-14 w-14 animate-spin text-red-500" />
                  <h2 className="mt-6 text-3xl font-bold">Creating preview</h2>
                  <p className="mt-3 text-lg text-white/80">Accessing HTML ...</p>
                </>
              )}
            </div>
          )}
          <div className="mx-auto min-h-full rounded-sm bg-white shadow-sm transition-all" style={{ width, maxWidth: "100%" }}>
            <iframe
              title="HTML preview"
              sandbox="allow-same-origin"
              srcDoc={previewHtml}
              className="h-[calc(100vh-150px)] min-h-[720px] w-full bg-white"
            />
          </div>
        </section>
        <SettingsPanel source={source} settings={settings} setSettings={setSettings} onRefresh={onRefresh} onPreview={onPreview} onConvert={onConvert} loading={loading} processing={processing} />
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
        const blob = await convertHtmlToPdfBlob(source.html, settings, {
          sourceLabel: source.kind === "url" ? source.finalUrl : source.file.name,
          onProgress: setProgress,
        });
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
        />
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} onUrl={loadUrl} onFile={loadFile} loading={loadingSource} />
    </>
  );
}
