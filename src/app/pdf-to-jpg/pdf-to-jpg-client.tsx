"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, FileImage, ImageIcon, Images, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToolCopy } from "@/components/i18n/UiText";
import { PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import type { ToolLandingCopy } from "@/lib/i18n/core-content";
import { PDF_IMAGE_COPY } from "@/lib/i18n/pdf-image-copy";
import { convertPdfImages, imageArchiveEntries, pdfImageThumbnail, PdfImageError, MAX_OUTPUT_BYTES, type ImageOutput, type ImageMode, type ImageFormat, type ImageResolution } from "@/lib/engines/pdf-image-engine";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
interface PdfItem { id: string; file: File }
interface ConversionResult { blob: Blob; filename: string; count: number; preview: string; width: number; height: number }
const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
// Serialize thumbnails rather than opening a worker for every selected file at once.
let thumbnailQueue: Promise<unknown> = Promise.resolve();
function Thumbnail({ file }: { file: File }) {
  const { locale } = useToolCopy(), copy = PDF_IMAGE_COPY[locale];
  const [preview, setPreview] = useState<{ url: string; pages: number } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    thumbnailQueue = thumbnailQueue.catch(() => undefined).then(async () => {
      if (!active) return;
      try { const result = await pdfImageThumbnail(file); if (active) setPreview(result); }
      catch { if (active) setFailed(true); }
    });
    return () => { active = false; };
  }, [file]);
  return <div className="flex h-52 items-center justify-center rounded-lg border bg-slate-50 p-3 dark:bg-slate-950">
    {preview ? <img src={preview.url} alt={file.name} className="max-h-full max-w-full object-contain shadow-sm" /> : <div role="status" className="space-y-3 p-2 text-center text-xs text-muted-foreground">{failed ? <FileImage className="mx-auto h-8 w-8" /> : <Loader2 className="mx-auto h-6 w-6 animate-spin" />}<p>{failed ? copy.previewError : copy.loading}</p></div>}
  </div>;
}
const DEFAULT_LANDING_COPY: ToolLandingCopy = { title: "PDF to JPG", description: "Turn PDF pages into clear images, or extract embedded pictures. Choose your resolution and download privately in your browser.", buttonLabel: "Select PDF files", dropLabel: "or drop PDFs here", limitLabel: "Up to 100MB per file" };

export function PdfToJpgClient({ landingCopy = DEFAULT_LANDING_COPY }: { landingCopy?: ToolLandingCopy }) {
  const { locale, t, title } = useToolCopy(), copy = PDF_IMAGE_COPY[locale];
  const [items, setItems] = useState<PdfItem[]>([]);
  const [mode, setMode] = useState<ImageMode>("pages");
  const [dpi, setDpi] = useState<ImageResolution>(300);
  const [format, setFormat] = useState<ImageFormat>("jpg");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const { processing, progress, setProgress, run, cancel } = useProcessingTask();
  useEffect(() => () => cancel(), [cancel]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.preview); }, [result]);
  const addFiles = useCallback((files: File[]) => {
    if (busyRef.current) return;
    if (files.some(file => file.size > MAX_FILE_SIZE || (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf"))) { toast.error(copy.invalid); return; }
    if (!files.length) return;
    setError(""); setResult(null); setProgress(0);
    setItems(current => [...current, ...files.map(file => ({ id: crypto.randomUUID(), file }))]);
  }, [copy.invalid, setProgress]);
  const dropzone = useDropzone({ accept: { "application/pdf": [".pdf"] }, multiple: true, maxSize: MAX_FILE_SIZE, disabled: processing, noClick: true, noKeyboard: true, onDropAccepted: addFiles, onDropRejected: () => toast.error(copy.invalid) });
  const clearAll = () => { setItems([]); setResult(null); setError(""); setProgress(0); };
  const convert = () => {
    if (!items.length || busyRef.current) return;
    busyRef.current = true; setError("");
    void run(async (update, cancelled) => {
      const outputs: ImageOutput[] = [];
      let totalBytes = 0;
      for (let index = 0; index < items.length; index++) {
        const next = await convertPdfImages(items[index].file, { mode, format, dpi, cancelled, remainingBytes: MAX_OUTPUT_BYTES - totalBytes, onProgress: (done, total) => update(95 * (index + done / total) / items.length) });
        outputs.push(...next); totalBytes += next.reduce((sum, output) => sum + output.bytes.byteLength, 0);
      }
      if (cancelled()) return;
      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      let blob: Blob, filename: string;
      if (outputs.length === 1) { blob = new Blob([outputs[0].bytes as BlobPart], { type: mime }); filename = outputs[0].name; }
      else {
        const { zip } = await import("fflate");
        const archive = await new Promise<Uint8Array>((resolve, reject) => zip(imageArchiveEntries(outputs), { level: 0 }, (err, bytes) => err ? reject(err) : resolve(bytes)));
        blob = new Blob([archive as BlobPart], { type: "application/zip" }); filename = `pdf-to-${format}-images.zip`;
      }
      if (cancelled()) return;
      const first = outputs[0];
      setResult({ blob, filename, count: outputs.length, preview: URL.createObjectURL(new Blob([first.bytes as BlobPart], { type: mime })), width: first.width, height: first.height });
      update(100);
    }, { successMessage: copy.ready, errorTitle: copy.canvas, toolName: "pdf-to-jpg", onError: cause => {
      const code = cause instanceof PdfImageError ? cause.code : "invalid";
      const message = code === "cancelled" ? "" : copy[code];
      setError(message); return message;
    } }).finally(() => { busyRef.current = false; });
  };
  const choiceClass = (selected: boolean) => cn("flex w-full items-center gap-3 rounded-xl border p-4 text-start text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-60", selected ? "border-slate-900 bg-slate-100 dark:border-slate-300 dark:bg-slate-800" : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800");

  if (result) return <PdfToolResultLayout toolSlug="pdf-to-jpg" showRelated={false} showTrust={false}>
    <div className="mx-auto max-w-xl space-y-6 py-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Check aria-hidden /></div>
      <h2 className="text-2xl font-bold">{copy.ready}</h2>
      <img src={result.preview} alt={result.filename} className="mx-auto max-h-64 max-w-full rounded-lg border object-contain" />
      <p className="text-sm text-muted-foreground">{copy.outputs}: {result.count} · {format.toUpperCase()} · {size(result.blob.size)}<br />{result.width} × {result.height} px</p>
      <p className="break-all text-sm">{result.filename}</p>
      <Button size="lg" className="w-full sm:w-auto" onClick={() => downloadBlob(result.blob, result.filename)}><Download className="me-2 h-4 w-4" aria-hidden />{copy.download}{result.count > 1 ? " (ZIP)" : ""}</Button>
      <div><Button variant="ghost" onClick={clearAll}>{t("Start over")}</Button></div>
    </div>
  </PdfToolResultLayout>;

  if (!items.length) return <PdfToolLanding title={landingCopy.title} description={landingCopy.description} buttonLabel={landingCopy.buttonLabel} dropLabel={landingCopy.dropLabel} limitLabel={landingCopy.limitLabel} accept={{ "application/pdf": [".pdf"] }} multiple icon={FileImage} iconClass="text-slate-900 dark:text-slate-100" iconBackgroundClass="bg-slate-100 dark:bg-slate-800" accent="orange" onFilesSelected={addFiles} rejectionMessage={copy.invalid} />;

  return <div className="flex min-h-[calc(100vh-72px)] flex-1 flex-col bg-slate-50 dark:bg-slate-950/40">
    <PdfWorkspaceBar title={title("PDF to JPG")} meta={`${copy.selected}: ${items.length}`} actions={<Button variant="ghost" disabled={processing} onClick={clearAll}>{t("Start over")}</Button>} />
    <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-6 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section {...dropzone.getRootProps({ role: "region", "aria-label": copy.selected })} className={cn("min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-6 dark:border-slate-800 dark:bg-slate-900/50", dropzone.isDragActive && "ring-2 ring-slate-600")}>
        <input {...dropzone.getInputProps()} />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{copy.selected} <span className="ms-2 text-muted-foreground">{items.length}</span></h2><Button variant="outline" disabled={processing} onClick={dropzone.open}><Plus className="me-2 h-4 w-4" aria-hidden />{copy.add}</Button></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(item => <article key={item.id} className="min-w-0 rounded-xl border bg-background p-3">
            <Thumbnail file={item.file} />
            <p className="mt-3 truncate text-sm font-medium" title={item.file.name}>{item.file.name}</p>
            <div className="mt-1 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{size(item.file.size)}</span><Button variant="ghost" size="icon" disabled={processing} aria-label={`${copy.remove} ${item.file.name}`} onClick={() => setItems(current => current.filter(entry => entry.id !== item.id))}><Trash2 className="h-4 w-4" aria-hidden /></Button></div>
          </article>)}
        </div>
        <p className="mt-6 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />{copy.privacy}</p>
      </section>
      <aside className="min-w-0 self-start rounded-2xl border bg-background p-5 md:p-6">
        <h2 className="mb-5 text-xl font-semibold tracking-tight">{copy.options}</h2>
        <fieldset disabled={processing} className="space-y-3"><legend className="sr-only">{copy.options}</legend>
          {(["pages", "images"] as const).map(value => { const Icon = value === "pages" ? ImageIcon : Images; return <button type="button" key={value} aria-pressed={mode === value} className={choiceClass(mode === value)} onClick={() => setMode(value)}><Icon className="h-5 w-5 shrink-0" aria-hidden /><span><span className="block font-semibold">{copy[value]}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{value === "pages" ? copy.pageHelp : copy.imageHelp}</span></span>{mode === value && <Check className="ms-auto h-4 w-4 shrink-0" aria-hidden />}</button>; })}
        </fieldset>
        <fieldset disabled={processing} className="mt-6"><legend className="mb-3 text-sm font-semibold">{copy.format}</legend><div className="grid grid-cols-2 gap-3">{(["jpg", "png"] as const).map(value => <button key={value} type="button" aria-pressed={format === value} className={choiceClass(format === value)} onClick={() => setFormat(value)}>{value.toUpperCase()}{format === value && <Check className="ms-auto h-4 w-4" aria-hidden />}</button>)}</div></fieldset>
        {mode === "pages" && <fieldset disabled={processing} className="mt-6 space-y-2"><legend className="mb-3 text-sm font-semibold">{copy.resolution}</legend>{([300, 150] as const).map(value => <button key={value} type="button" aria-pressed={dpi === value} className={choiceClass(dpi === value)} onClick={() => setDpi(value)}>{value === 300 ? copy.high : copy.standard}{dpi === value && <Check className="ms-auto h-4 w-4 shrink-0" aria-hidden />}</button>)}</fieldset>}
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{copy.qualityNote}</p>
        {mode === "images" && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-muted-foreground dark:bg-slate-800">{copy.extractNote}</p>}
        {error && <p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">{error}</p>}
        {processing && <div role="status" aria-live="polite" className="mt-5 space-y-2"><p className="text-sm">{copy.working} {Math.round(progress)}%</p><Progress value={progress} aria-label={copy.working} /></div>}
        <Button size="lg" onClick={convert} disabled={processing} className="mt-6 min-h-14 w-full whitespace-normal py-3 text-base">{processing ? <Loader2 className="me-2 h-5 w-5 shrink-0 animate-spin" aria-hidden /> : <Download className="me-2 h-5 w-5 shrink-0" aria-hidden />}{processing ? copy.working : copy.convert}</Button>
      </aside>
    </div>
  </div>;
}
