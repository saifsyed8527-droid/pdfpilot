"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  FileText,
  HardDrive,
  Info,
  Link as LinkIcon,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { TrustSection } from "@/components/tool/TrustSection";
import { getCrossSellTools } from "@/lib/cross-sell";
import { downloadBlob } from "@/lib/download-file";
import { createSearchableOcrPdf, type SearchableOcrPdfResult } from "@/lib/engines/ocr-engine";
import { renderFirstPageThumbnailWithInfo } from "@/lib/engines/pdf-render-engine";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { useProcessingTask } from "@/lib/use-processing-task";
import { cn, formatFileSize } from "@/lib/utils";

const ACCEPTED_PDF = { "application/pdf": [".pdf"] };
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const LANGUAGES = [
  { id: "eng", name: "English" },
  { id: "afr", name: "Afrikaans" },
  { id: "sqi", name: "Albanian" },
  { id: "amh", name: "Amharic" },
  { id: "ara", name: "Arabic" },
  { id: "hye", name: "Armenian" },
  { id: "asm", name: "Assamese" },
  { id: "aze_cyrl", name: "Azerbaijani - Cyrillic" },
  { id: "hin", name: "Hindi" },
  { id: "chi_sim", name: "Chinese - Simplified" },
  { id: "chi_tra", name: "Chinese - Traditional" },
];

interface OcrOutput extends SearchableOcrPdfResult {
  filename: string;
}

function BackToHome() {
  return (
    <Link href="/" className="mb-7 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Home
    </Link>
  );
}

function SourceButtons() {
  return (
    <div className="flex flex-col gap-2">
      <button type="button" aria-label="Import from Google Drive" className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600">
        <HardDrive className="h-5 w-5" aria-hidden />
      </button>
      <button type="button" aria-label="Import from Dropbox" className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600">
        <HardDrive className="h-5 w-5 rotate-45" aria-hidden />
      </button>
    </div>
  );
}

function Landing({
  dragActive,
  getRootProps,
  getInputProps,
}: {
  dragActive: boolean;
  getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
  getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
}) {
  return (
    <div className="flex flex-1 bg-[#f7f7fb] py-10 dark:bg-slate-950/50 md:py-14">
      <div className="container mx-auto flex max-w-6xl flex-1 flex-col px-4">
        <BackToHome />
        <section className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white">OCR PDF</h1>
          <p className="mt-5 max-w-4xl text-xl leading-9 text-slate-600 dark:text-slate-300">
            Convert non-selectable PDF files into selectable and searchable PDF with high accuracy.
          </p>
          <div className="mt-9 flex items-start justify-center gap-4">
            <div
              {...getRootProps({ role: "button", "aria-label": "Select PDF file or drop PDF here" })}
              className={cn(
                "flex w-[min(36rem,78vw)] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white p-5 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.62)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-slate-900",
                dragActive ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-transparent hover:border-red-300"
              )}
            >
              <input {...getInputProps()} />
              <span className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-xl bg-red-500 px-8 py-4 text-xl font-bold text-white shadow-lg transition hover:bg-red-600">
                <Upload className="h-6 w-6" aria-hidden />
                {dragActive ? "Drop PDF here" : "Select PDF file"}
              </span>
              <span className="mt-4 text-sm text-slate-500">or drop PDF here</span>
            </div>
            <SourceButtons />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden /> Files stay on your device</span>
            <span>English OCR model included</span>
            <span>100MB max per PDF</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function PdfCard({
  file,
  thumbnail,
  onRemove,
  processing,
}: {
  file: File;
  thumbnail: string | null | undefined;
  onRemove: () => void;
  processing: boolean;
}) {
  return (
    <article className="group/card relative flex h-[326px] w-[276px] flex-col items-center justify-center rounded-lg bg-white p-4 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.65)] ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      <div className="pointer-events-none absolute -top-10 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
        {formatFileSize(file.size)}
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={processing}
        aria-label={`Remove ${file.name}`}
        className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-200 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 md:opacity-0 md:group-hover/card:opacity-100 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <div className="flex h-[235px] w-[180px] items-center justify-center overflow-hidden bg-white shadow-md">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- canvas snapshot from local PDF
          <img src={thumbnail} alt="" className="h-full w-full object-contain" />
        ) : thumbnail === null ? (
          <FileText className="h-12 w-12 text-slate-400" aria-hidden />
        ) : (
          <div className="h-full w-full animate-pulse bg-slate-100" aria-hidden />
        )}
      </div>
      <p className="mt-4 w-full truncate text-center text-sm font-medium text-slate-600 dark:text-slate-300" title={file.name}>
        {file.name}
      </p>
    </article>
  );
}

function FloatingButton({
  label,
  count,
  disabled,
  onClick,
  children,
}: {
  label: string;
  count?: number;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="group/floating relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50"
        aria-label={label}
      >
        {children}
        {typeof count === "number" && <span className="absolute -left-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950 px-1 text-xs font-bold text-white ring-2 ring-red-500">{count}</span>}
      </button>
      <span className="pointer-events-none absolute right-14 top-1/2 z-30 -translate-y-1/2 whitespace-nowrap rounded bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover/floating:opacity-100 group-focus-within/floating:opacity-100">
        {label}
      </span>
    </div>
  );
}

function LanguagePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (languages: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selectedLanguages = useMemo(
    () => selected.map((id) => LANGUAGES.find((language) => language.id === id)).filter(Boolean) as typeof LANGUAGES,
    [selected]
  );
  const filteredLanguages = useMemo(
    () => LANGUAGES.filter((language) => language.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );

  const toggleLanguage = (id: string) => {
    if (selected.includes(id)) {
      const next = selected.filter((languageId) => languageId !== id);
      onChange(next.length ? next : ["eng"]);
      return;
    }
    if (selected.length >= 3) {
      toast.error("You can select up to 3 languages.");
      return;
    }
    onChange([...selected, id]);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-slate-700 dark:bg-slate-950"
      >
        <span className="flex flex-wrap gap-2">
          {selectedLanguages.map((language) => (
            <span key={language.id} className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-sky-950 dark:text-sky-100">
              {language.name}
              <X className="h-3.5 w-3.5" aria-hidden />
            </span>
          ))}
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-slate-600" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 overflow-hidden rounded-md border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-12 w-full bg-transparent pl-9 pr-3 text-sm outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {filteredLanguages.map((language) => {
              const checked = selected.includes(language.id);
              return (
                <button
                  type="button"
                  key={language.id}
                  onClick={() => toggleLanguage(language.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded border border-slate-400", checked && "border-red-500 bg-red-500 text-white")}>
                    {checked && <Check className="h-3.5 w-3.5" aria-hidden />}
                  </span>
                  <span>{language.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OcrPanel({
  selectedLanguages,
  onLanguagesChange,
  onRun,
}: {
  selectedLanguages: string[];
  onLanguagesChange: (languages: string[]) => void;
  onRun: () => void;
}) {
  return (
    <aside className="bg-white p-5 dark:bg-slate-900 lg:h-[calc(100vh-5.15rem)] lg:min-h-[640px] lg:border-l lg:p-6">
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-6 border-b pb-5 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">OCR PDF options</h2>
        </div>
        <div className="rounded-xl bg-sky-100 px-4 py-4 text-left text-sm leading-6 text-slate-800 dark:bg-sky-950/40 dark:text-slate-100">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" aria-hidden />
            <p>The accuracy of detection is increased by correctly selecting the document&apos;s languages.</p>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-base font-bold text-slate-800 dark:text-slate-100">Document languages</label>
            <span className="text-base font-medium text-slate-600 dark:text-slate-300">{selectedLanguages.length}/3</span>
          </div>
          <LanguagePicker selected={selectedLanguages} onChange={onLanguagesChange} />
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onRun}
          className="flex min-h-16 w-full items-center justify-center gap-3 rounded-xl bg-red-500 px-6 py-4 text-xl font-bold text-white shadow-lg transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          Apply OCR <ArrowRight className="h-6 w-6" aria-hidden />
        </button>
      </div>
    </aside>
  );
}

function ProcessingScreen({ progress, onCancel }: { progress: number; onCancel: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-[#f7f7fb] px-4 py-16 dark:bg-slate-950/50">
      <div className="text-center">
        <div className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">
          I<span className="text-red-500">♥</span>PDF
        </div>
        <h1 className="mt-28 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Recognising text...</h1>
        <div className="mx-auto mt-10 h-28 w-28 animate-spin rounded-full border-[14px] border-slate-200 border-l-red-500 dark:border-slate-800 dark:border-l-red-500" aria-hidden />
        <p role="status" className="mt-5 text-sm font-medium text-slate-500">{Math.round(progress)}% complete</p>
        <button type="button" onClick={onCancel} className="mt-8 rounded-md border px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white dark:text-slate-200 dark:hover:bg-slate-900">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ResultView({
  result,
  onDownload,
  onStartOver,
  autoDownloadRef,
}: {
  result: OcrOutput;
  onDownload: () => void;
  onStartOver: () => void;
  autoDownloadRef: React.MutableRefObject<boolean>;
}) {
  useEffect(() => {
    if (!autoDownloadRef.current) {
      autoDownloadRef.current = true;
      onDownload();
    }
  }, [autoDownloadRef, onDownload]);

  return (
    <div className="flex-1 bg-[#f7f7fb] py-10 dark:bg-slate-950/50 md:py-14">
      <div className="container mx-auto max-w-4xl px-4">
        <BackToHome />
        <section className="flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Your PDF is now selectable and searchable</h1>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={onStartOver} aria-label="Back" className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-white shadow-lg transition hover:bg-slate-800">
              <ArrowLeft className="h-6 w-6" aria-hidden />
            </button>
            <button type="button" onClick={onDownload} className="flex min-h-20 min-w-[28rem] max-w-full items-center justify-center gap-4 rounded-xl bg-red-500 px-8 py-5 text-2xl font-bold text-white shadow-lg transition hover:bg-red-600">
              <Download className="h-8 w-8" aria-hidden /> Download PDF
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" aria-label="Save to Drive" className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-md"><HardDrive className="h-5 w-5" aria-hidden /></button>
              <button type="button" aria-label="Copy link" className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-md"><LinkIcon className="h-5 w-5" aria-hidden /></button>
              <button type="button" aria-label="Save to Dropbox" className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-md"><HardDrive className="h-5 w-5 rotate-45" aria-hidden /></button>
              <button type="button" aria-label="Delete result" className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-md"><Trash2 className="h-5 w-5" aria-hidden /></button>
            </div>
          </div>
          <p className="mt-5 text-sm text-slate-500">
            {result.pageCount} page{result.pageCount === 1 ? "" : "s"} processed. {formatFileSize(result.blob.size)}
          </p>
        </section>
        <RelatedTools title="Continue to..." tools={getCrossSellTools("ocr-pdf")} />
        <TrustSection />
      </div>
    </div>
  );
}

export function OcrPdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null | undefined>(undefined);
  const [selectedLanguages, setSelectedLanguages] = useState(["eng"]);
  const [result, setResult] = useState<OcrOutput | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoDownloadRef = useRef(false);
  const { processing, progress, run, cancel } = useProcessingTask();

  const addFiles = useCallback((files: File[]) => {
    const next = files.find((candidate) => candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf"));
    if (!next) {
      toast.error("Please choose a PDF file.");
      return;
    }
    if (next.size > MAX_FILE_SIZE) {
      toast.error("PDF is too large", { description: "Please choose a file under 100MB." });
      return;
    }
    setFile(next);
    setThumbnail(undefined);
    setResult(null);
    autoDownloadRef.current = false;
  }, []);

  const reportRejections = useCallback((rejections: FileRejection[]) => {
    for (const rejection of rejections) {
      for (const error of rejection.errors) {
        toast.error(error.code === "file-too-large" ? "PDF is too large" : "Could not add PDF", {
          description: error.code === "file-too-large" ? `${rejection.file.name} exceeds 100MB.` : error.message,
        });
      }
    }
  }, []);

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    if (rejected.length > 0) reportRejections(rejected);
    if (accepted.length > 0) addFiles(accepted);
  }, [addFiles, reportRejections]);

  const dropzone = useDropzone({
    onDrop,
    accept: ACCEPTED_PDF,
    multiple: false,
    maxSize: MAX_FILE_SIZE,
    noClick: !!file,
    noKeyboard: !!file,
    disabled: processing,
  });

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setThumbnail(undefined);
    renderFirstPageThumbnailWithInfo(file)
      .then(({ thumbnail }) => {
        if (!cancelled) setThumbnail(thumbnail);
      })
      .catch(() => {
        if (!cancelled) setThumbnail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const clear = () => {
    setFile(null);
    setThumbnail(undefined);
    setResult(null);
    autoDownloadRef.current = false;
  };

  const runOcr = () => {
    if (!file) return;
    const unsupported = selectedLanguages.some((language) => language !== "eng");
    if (unsupported) {
      toast.info("English OCR is bundled right now", {
        description: "The selected language UI is saved, but this browser run will use the local English OCR model.",
      });
    }

    run(async (setProgress, isCancelled) => {
      setResult(null);
      autoDownloadRef.current = false;
      const output = await createSearchableOcrPdf(file, setProgress, isCancelled);
      if (!output || isCancelled()) return;
      setResult({
        ...output,
        filename: `${safeBaseName(file.name)}_ocr.pdf`,
      });
    }, {
      successMessage: "Your searchable PDF is ready!",
      toolName: "ocr-pdf",
      errorTitle: "Could not apply OCR",
      onError: (error) => error instanceof Error ? error.message : "Try a cleaner scan or another PDF.",
    });
  };

  const downloadResult = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename);
  }, [result]);

  if (processing) {
    return <ProcessingScreen progress={progress} onCancel={cancel} />;
  }

  if (result) {
    return <ResultView result={result} onDownload={downloadResult} onStartOver={clear} autoDownloadRef={autoDownloadRef} />;
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          addFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      {!file ? (
        <Landing dragActive={dropzone.isDragActive} getRootProps={dropzone.getRootProps} getInputProps={dropzone.getInputProps} />
      ) : (
        <div className="flex-1 bg-[#f7f7fb] dark:bg-slate-950/50">
          <div className="grid min-h-[calc(100vh-5.15rem)] lg:grid-cols-[minmax(0,1fr)_420px]">
            <section
              {...dropzone.getRootProps()}
              className="relative flex min-h-[620px] flex-col p-5 focus-visible:outline-none lg:p-8"
              aria-label="OCR PDF workspace. Drop another PDF here to replace the selected file."
            >
              <input {...dropzone.getInputProps()} />
              {dropzone.isDragActive && (
                <div className="absolute inset-4 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-red-500 bg-red-50/95 text-center dark:bg-red-950/80">
                  <div><Upload className="mx-auto h-10 w-10 text-red-500" aria-hidden /><p className="mt-3 text-lg font-semibold">Drop to replace PDF</p></div>
                </div>
              )}
              <div className="mb-6 flex items-center justify-end">
                <FloatingButton count={1} label="Add more files" disabled={processing} onClick={() => fileInputRef.current?.click()}>
                  <Plus className="h-7 w-7" aria-hidden />
                </FloatingButton>
              </div>
              <div className="flex flex-1 items-center justify-center">
                <PdfCard file={file} thumbnail={thumbnail} onRemove={clear} processing={processing} />
              </div>
            </section>
            <OcrPanel selectedLanguages={selectedLanguages} onLanguagesChange={setSelectedLanguages} onRun={runOcr} />
          </div>
        </div>
      )}
    </>
  );
}
