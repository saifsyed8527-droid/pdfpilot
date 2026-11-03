"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Languages } from "lucide-react";
import {
  PdfToolLanding,
  PdfToolResultLayout,
  PdfWorkspaceBar,
} from "@/components/tool/PdfToolChrome";
import { SourceFilePreview } from "@/components/tool/SourceFilePreview";
import { OcrLanguagePicker } from "@/components/tool/OcrLanguagePicker";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { useProcessingTask } from "@/lib/use-processing-task";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize } from "@/lib/utils";
import { pdfDocumentInputError } from "@/lib/engines/conversion-input-errors";
import {
  TRANSLATION_LANGUAGES,
  browserTranslator,
  translationPair,
  translatePages,
  translatedText,
  translatedWordPages,
  translationError,
  TranslationInputError,
  type TranslationAvailability,
  type LocalTranslator,
  type TranslatedPage,
} from "@/lib/engines/pdf-translation";
import {
  readPdfWordPages,
  createWordFromPages,
  type PdfWordMode,
} from "@/lib/engines/pdf-word-engine";

const fieldClass = "h-11 w-full rounded-xl border bg-background px-3 text-sm";
const notice =
  "Free local translation requires a supported desktop browser, such as Chrome 138+ or Edge 148+. Mobile, Safari and Firefox are not supported. Your browser downloads language packs on first use; PDF Pilot does not upload your PDF or extracted text for translation.";
type OutputFormat = "pdf" | "docx" | "txt";
type Result = {
  blob: Blob;
  filename: string;
  pages: TranslatedPage[];
  notes: string[];
};
function LanguageSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const matches = TRANSLATION_LANGUAGES.filter(
    ([code, name]) =>
      code === value ||
      `${name} ${code}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <input
        aria-label={`Search ${label.toLowerCase()}`}
        placeholder="Search languages"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={fieldClass}
      />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      >
        {matches.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      {search &&
        matches.length === 1 &&
        !`${matches[0][1]} ${value}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()) && (
          <p className="text-xs">No match. Your current language is kept.</p>
        )}
    </fieldset>
  );
}
function basename(name: string) {
  return (
    Array.from(
      name
        .replace(/\.pdf$/i, "")
        .normalize("NFC")
        .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "-"),
    )
      .slice(0, 120)
      .join("")
      .trim() || "document"
  );
}

export function TranslatePdfClient() {
  const [file, setFile] = useState<File | null>(null),
    [result, setResult] = useState<Result | null>(null);
  const [source, setSource] = useState("en"),
    [target, setTarget] = useState("hi");
  const [support, setSupport] = useState<boolean | null>(null),
    [availability, setAvailability] = useState<
      TranslationAvailability | "checking" | "error"
    >("checking");
  const [pages, setPages] = useState(""),
    [mode, setMode] = useState<PdfWordMode>("auto"),
    [languages, setLanguages] = useState<string[]>(["eng"]);
  const [format, setFormat] = useState<OutputFormat>("pdf"),
    [bilingual, setBilingual] = useState(false),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [label, setLabel] = useState("Preparing translation…");
  const busyRef = useRef(false),
    abortRef = useRef<AbortController | null>(null),
    autoDownloaded = useRef(false),
    mounted = useRef(true),
    errorRef = useRef<HTMLParagraphElement>(null);
  const { processing, progress, run, cancel } = useProcessingTask();
  const locked = busy || processing;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
      cancel();
    };
  }, [cancel]);
  useEffect(() => {
    const api = browserTranslator();
    setSupport(!!api);
    let active = true;
    setAvailability("checking");
    if (!api || source === target) {
      setAvailability("unavailable");
      return;
    }
    api.availability({ sourceLanguage: source, targetLanguage: target }).then(
      (value) => {
        if (active) setAvailability(value);
      },
      () => {
        if (active) setAvailability("error");
      },
    );
    return () => {
      active = false;
    };
  }, [source, target]);
  useEffect(() => {
    if (file || result) window.scrollTo({ top: 0, behavior: "instant" });
  }, [file, result]);
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
      errorRef.current.focus({ preventScroll: true });
    }
  }, [error]);
  const changeSource = (code: string) => {
    setSource(code);
    const ocr = TRANSLATION_LANGUAGES.find(([id]) => id === code)?.[2];
    if (ocr) setLanguages([ocr]);
    else setMode("text");
    setError("");
  };
  const choose = (files: File[]) => {
    if (busyRef.current || !files[0]) return;
    const next = files[0];
    if (
      !(next.type === "application/pdf" || /\.pdf$/i.test(next.name)) ||
      !next.size ||
      next.size > 100 * 1024 * 1024
    ) {
      setError("Choose a non-empty PDF up to 100MB.");
      return;
    }
    setFile(next);
    setResult(null);
    setPages("");
    setError("");
    autoDownloaded.current = false;
  };
  const reset = () => {
    if (busyRef.current) return;
    setFile(null);
    setResult(null);
    setError("");
    autoDownloaded.current = false;
  };
  const stop = () => {
    abortRef.current?.abort();
    cancel();
    setLabel("Stopping translation…");
  };
  const convert = () => {
    const api = browserTranslator();
    if (!file || busyRef.current || !api) return;
    try {
      translationPair(source, target);
    } catch (error) {
      setError(translationError(error));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    autoDownloaded.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    void run(
      async (setProgress, isCancelled) => {
        let translator: LocalTranslator | undefined,
          timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, 600_000);
        const live = () =>
          mounted.current && !controller.signal.aborted && !isCancelled();
        const checkpoint = () => {
          if (!live())
            throw new DOMException("Translation stopped", "AbortError");
        };
        try {
          setLabel(
            "Preparing language pack… This may take a few minutes on first use.",
          );
          // Must run directly from the user's click, before extraction or other awaits.
          translator = await api.create({
            sourceLanguage: source,
            targetLanguage: target,
            signal: controller.signal,
            monitor(monitor) {
              monitor.addEventListener("downloadprogress", (event) => {
                if (live()) {
                  setProgress(Math.max(0, Math.min(1, event.loaded)) * 12);
                  setLabel(
                    `Preparing language pack… ${Math.round(Math.max(0, Math.min(1, event.loaded)) * 100)}%`,
                  );
                }
              });
            },
          });
          checkpoint();
          const extracted = await readPdfWordPages(file, {
            mode,
            maxPages: 50,
            pages,
            languages,
            dpi: 150,
            signal: controller.signal,
            isCancelled,
            onProgress: (value) => {
              if (live()) setProgress(12 + value * 0.23);
            },
            onStatus: (value) => {
              if (live()) setLabel(value);
            },
          }).catch((failure) => {
            if (controller.signal.aborted) throw failure;
            throw new TranslationInputError(pdfDocumentInputError(failure));
          });
          checkpoint();
          if (!extracted)
            throw new TranslationInputError(
              "No readable text was found. Try Free OCR or a clearer scan.",
            );
          const translated = await translatePages(extracted.pages, translator, {
            sourceLanguage: source,
            targetLanguage: target,
            signal: controller.signal,
            onProgress: (value) => {
              if (live()) setProgress(35 + value * 0.55);
            },
            onStatus: (value) => {
              if (live()) setLabel(value);
            },
          });
          checkpoint();
          setLabel("Creating your translated document…");
          const blob =
            format === "txt"
              ? new Blob([translatedText(translated, bilingual)], {
                  type: "text/plain;charset=utf-8",
                })
              : format === "docx"
                ? await createWordFromPages(
                    translatedWordPages(translated, bilingual),
                  )
                : await (
                    await import("@/lib/engines/translated-pdf")
                  )
                    .createTranslatedPdf(translated, {
                      bilingual,
                      signal: controller.signal,
                    })
                    .catch((failure) => {
                      if (
                        controller.signal.aborted ||
                        failure instanceof TranslationInputError
                      )
                        throw failure;
                      throw new TranslationInputError(
                        "The translated PDF could not be created. Try Word or Text output; these formats support a wider range of characters.",
                      );
                    });
          checkpoint();
          if (blob.size > 100 * 1024 * 1024)
            throw new TranslationInputError(
              "Output exceeds 100MB. Choose fewer pages.",
            );
          const notes = [
            "Machine translation can change meaning. Review names, numbers and important wording against the original.",
            "This is a text document. Pictures, tables, columns, links and original page layout are not reconstructed.",
          ];
          if (extracted.usedOcr)
            notes.push(
              "OCR was used for scanned text. Check recognition errors before relying on the translation.",
            );
          if (extracted.unrecognizedPages.length)
            notes.push(
              `No text was recognized on source pages ${extracted.unrecognizedPages.join(", ")}. They are explicitly marked in the output.`,
            );
          const imagePages = extracted.pageReports
            .filter((p) => p.imagesNotTranscribed)
            .map((p) => p.page);
          if (imagePages.length)
            notes.push(
              `Text inside pictures on pages ${imagePages.join(", ")} was not read. Use Free OCR if these images contain text.`,
            );
          setResult({
            blob,
            filename: `${basename(file.name)}-${target}.${format}`,
            pages: translated,
            notes,
          });
          setProgress(100);
        } catch (error) {
          if (timedOut)
            throw new TranslationInputError(
              "Translation took too long. Retry with fewer pages; your browser may have cached the language pack.",
            );
          throw error;
        } finally {
          clearTimeout(timer);
          try {
            translator?.destroy();
          } catch {
            /* Already destroyed on cancellation. */
          }
          controller.abort();
          if (abortRef.current === controller) abortRef.current = null;
          busyRef.current = false;
          if (mounted.current) {
            setBusy(false);
            if (isCancelled())
              setError(
                "Translation stopped. Your file and settings are kept. You can try again.",
              );
          }
        }
      },
      {
        toolName: "translate-pdf",
        successMessage: "Your translation is ready.",
        errorTitle: "Translation could not finish",
        onError: (failure) => {
          setError(translationError(failure));
          return "Review the message beside translation settings and retry.";
        },
      },
    );
  };
  const errorBox = error && (
    <p
      ref={errorRef}
      role="alert"
      tabIndex={-1}
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
    >
      {error}
    </p>
  );
  if (!file)
    return (
      <>
        <PdfToolLanding
          title="Translate PDF"
          description="Translate PDF text and scans into another language. Free, on your device, in supported desktop browsers."
          buttonLabel="Select PDF file"
          dropLabel="or drop PDF here"
          limitLabel="PDF up to 100MB · up to 50 selected pages"
          accept={{ "application/pdf": [".pdf"] }}
          multiple={false}
          icon={Languages}
          iconClass="text-emerald-600"
          iconBackgroundClass="bg-emerald-100 dark:bg-emerald-950"
          accent="orange"
          onFilesSelected={choose}
        />
        <div className="mx-auto mb-8 w-[calc(100%-2rem)] max-w-2xl space-y-4">
          {errorBox}
          <p
            role={support === false ? "status" : undefined}
            className="rounded-2xl border p-4 text-sm leading-6"
          >
            {support === false && (
              <strong className="mb-2 block">
                Translation is unavailable in this browser.
              </strong>
            )}
            {notice}
          </p>
          <p className="text-sm text-muted-foreground">
            Download a readable PDF, editable Word document or plain text.
            Original visual layout is not preserved.
          </p>
        </div>
      </>
    );
  if (result)
    return (
      <PdfToolResultLayout toolSlug="translate-pdf">
        <div data-clarity-mask="True">
          <ResultState
            resultFilename={result.filename}
            fileSize={formatFileSize(result.blob.size)}
            onDownload={() => downloadBlob(result.blob, result.filename)}
            onStartOver={reset}
            autoDownloadedRef={autoDownloaded}
            downloadLabel="Download translation"
          />
          <div className="my-4 flex justify-center">
            <button
              className="rounded-xl border px-4 py-3"
              onClick={() => {
                setResult(null);
                setError("");
              }}
            >
              Adjust options
            </button>
          </div>
          <ul className="space-y-2 rounded-2xl border bg-amber-50 p-5 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            {result.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <div className="mt-6 space-y-4">
            {result.pages.map((page) => (
              <details
                key={page.pageNumber}
                className="rounded-xl border p-4"
                open={result.pages.length === 1}
              >
                <summary className="cursor-pointer font-semibold">
                  Source page {page.pageNumber} — review translation
                </summary>
                <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
                  <section>
                    <h3 className="font-semibold">Original</h3>
                    <p
                      dir="auto"
                      className="mt-2 whitespace-pre-wrap break-words text-sm leading-7"
                    >
                      {page.original.join("\n\n") || "No readable text."}
                    </p>
                  </section>
                  <section>
                    <h3 className="font-semibold">Translation</h3>
                    <p
                      dir="auto"
                      className="mt-2 whitespace-pre-wrap break-words text-sm leading-7"
                    >
                      {page.translated.join("\n\n") || "No readable text."}
                    </p>
                  </section>
                </div>
              </details>
            ))}
          </div>
        </div>
      </PdfToolResultLayout>
    );
  return (
    <div
      className="flex flex-1 flex-col bg-slate-50/70 dark:bg-slate-950/40"
      data-clarity-mask="True"
    >
      <PdfWorkspaceBar
        title="Translate PDF"
        meta={`${file.name} · ${formatFileSize(file.size)}`}
        actions={
          <button
            disabled={locked}
            onClick={reset}
            className="rounded-xl border px-4 py-2 disabled:opacity-50"
          >
            Start over
          </button>
        }
      />
      <div className="container mx-auto grid w-full max-w-[1500px] min-w-0 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_370px] lg:items-start">
        <section
          aria-label="Original PDF preview"
          className="min-w-0 rounded-3xl border bg-white p-4 dark:bg-slate-900"
        >
          <SourceFilePreview file={file} />
        </section>
        <aside
          aria-label="Translation settings"
          className="min-w-0 space-y-4 rounded-3xl border bg-white p-5 dark:bg-slate-900"
        >
          <h2 className="text-xl font-bold">Translation settings</h2>
          <LanguageSelect
            label="Source language"
            value={source}
            onChange={changeSource}
            disabled={locked}
          />
          <button
            disabled={locked}
            onClick={() => {
              changeSource(target);
              setTarget(source);
            }}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Swap languages
          </button>
          <LanguageSelect
            label="Target language"
            value={target}
            onChange={(value) => {
              setTarget(value);
              setError("");
            }}
            disabled={locked}
          />
          {source === target && (
            <p role="alert" className="text-sm text-red-700">
              Choose a different target language.
            </p>
          )}
          <p
            role="status"
            className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800"
          >
            {support === false
              ? "This browser cannot translate. Open this tool in a supported desktop browser."
              : availability === "checking"
                ? "Checking this language pair…"
                : availability === "unavailable" && source !== target
                  ? "This language pair is unavailable in your browser."
                  : availability === "error"
                    ? "Language availability could not be checked. You can retry with Translate."
                    : availability === "available"
                      ? "Language pack ready. Translation runs on your device."
                      : "Your browser will prepare the language pack when you click Translate. The first download may take a few minutes."}
          </p>
          <fieldset disabled={locked} className="space-y-4">
            <label className="block space-y-2 text-sm font-semibold">
              Pages to translate
              <input
                className={fieldClass}
                placeholder="All pages, or 1-3, 5"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                maxLength={2000}
              />
              <span className="block text-xs font-normal text-muted-foreground">
                Up to 50 pages and 200,000 text characters per run.
              </span>
            </label>
            <label className="block space-y-2 text-sm font-semibold">
              Text recognition
              <select
                className={fieldClass}
                value={mode}
                onChange={(e) => setMode(e.target.value as PdfWordMode)}
              >
                <option value="auto">Auto — OCR pages without text</option>
                <option value="ocr">Free OCR — read every page</option>
                <option value="text">No OCR — selectable text only</option>
              </select>
            </label>
            {mode !== "text" && (
              <OcrLanguagePicker
                value={languages}
                onChange={setLanguages}
                disabled={locked}
              />
            )}
            <label className="block space-y-2 text-sm font-semibold">
              Download format
              <select
                className={fieldClass}
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
              >
                <option value="pdf">PDF (.pdf)</option>
                <option value="docx">Word (.docx)</option>
                <option value="txt">Text (.txt)</option>
              </select>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={bilingual}
                onChange={(e) => setBilingual(e.target.checked)}
                className="mt-1"
              />
              Include original text before each page’s translation
            </label>
          </fieldset>
          {errorBox}
          {locked ? (
            <ProcessingState
              progress={progress}
              label={label}
              cancelable
              onCancel={stop}
            />
          ) : (
            <button
              disabled={
                !support ||
                availability === "checking" ||
                availability === "unavailable" ||
                source === target
              }
              onClick={convert}
              className="w-full rounded-xl bg-emerald-600 px-5 py-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Translate PDF
            </button>
          )}
          <p className="text-xs leading-5 text-muted-foreground">{notice}</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Output is translated text with source-page markers. Pictures, tables
            and original visual layout are not preserved. Review machine
            translation and OCR for errors.
          </p>
        </aside>
      </div>
    </div>
  );
}
