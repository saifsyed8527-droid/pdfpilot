"use client";
import { useWorkspaceText, UiText } from "@/components/i18n/WorkspaceText";


import { useEffect, useMemo, useRef, useState } from "react";
import { FileToolLayout } from "@/components/tool/FileToolLayout";
import { SourceFilePreview } from "@/components/tool/SourceFilePreview";
import { Button } from "@/components/ui/button";
import { createSearchableOcrPdf, exportOcrResult, type SearchableOcrPdfResult } from "@/lib/engines/ocr-engine";
import { OCR_LANGUAGES, ocrLanguages, ocrPages } from "@/lib/engines/ocr-options";
import { safeBaseName } from "@/lib/engines/pdf-split-engine";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { formatFileSize } from "@/lib/utils";

type Format = "pdf" | "txt" | "docx";
interface Output extends SearchableOcrPdfResult { primary: Blob; filename: string; base: string; languages: string[] }
const fieldClass = "mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm";
export function OcrPdfClient() {
  const __copy = useWorkspaceText();
  const [file, setFile] = useState<File | null>(null), [pending, setPending] = useState<File | null>(null), [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [result, setResult] = useState<Output | null>(null);
  const [languages, setLanguages] = useState<string[]>(["eng"]), [search, setSearch] = useState(""), [pages, setPages] = useState(""), [dpi, setDpi] = useState(150), [format, setFormat] = useState<Format>("pdf");
  const [exporting, setExporting] = useState(false), [copied, setCopied] = useState(false);
  const generation = useRef(0), controller = useRef<AbortController | null>(null), { processing, progress, run, cancel } = useProcessingTask();
  useEffect(() => () => { generation.current++; controller.current?.abort(); cancel(); }, [cancel]);
  const stop = () => { generation.current++; controller.current?.abort(); cancel(); setLoading(false); setPending(null); };
  const reset = () => { stop(); setFile(null); setPageCount(0); setResult(null); setError(""); setPages(""); setCopied(false); setExporting(false); };
  const choose = async (files: File[]) => {
    const source = files[0]; if (!source) return; stop(); const id = ++generation.current; setLoading(true); setPending(source); setError("");
    try {
      if ((!/\.pdf$/i.test(source.name) && source.type !== "application/pdf") || source.size > 100 * 1024 * 1024) throw new Error("Choose a PDF up to 100MB.");
      const bytes = await source.arrayBuffer(); if (id !== generation.current) return;
      const stable = new File([bytes], source.name, { type: "application/pdf" });
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false }).catch(() => { throw new Error("This PDF is damaged or password-protected. Choose an unlocked, readable copy."); });
      if (pdf.isEncrypted || !pdf.getPageCount() || pdf.getPageCount() > 2000) throw new Error("Choose an unlocked PDF with 1–2,000 pages.");
      if (id === generation.current) { setFile(stable); setPageCount(pdf.getPageCount()); setResult(null); setPages(""); setCopied(false); }
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : "This PDF could not be read. Try another file."); }
    finally { if (id === generation.current) { setLoading(false); setPending(null); } }
  };
  const execute = () => {
    if (!file) return;
    try { ocrLanguages(languages); ocrPages(pages, pageCount); } catch (e) { setError((e as Error).message); return; }
    const abort = new AbortController(); controller.current = abort; setError(""); setCopied(false);
    void run(async (setProgress, cancelled) => {
      const output = await createSearchableOcrPdf(file, setProgress, cancelled, abort.signal, { languages, pages, dpi });
      if (!output || cancelled()) return;
      const primary = format === "pdf" ? output.blob : await exportOcrResult(output.recognizedText, format);
      if (cancelled()) return;
      const base = safeBaseName(file.name);
      setResult({ ...output, primary, base, languages: [...languages], filename: `${base}_${format === "pdf" ? "searchable" : "recognized"}.${format}` });
    }, { toolName: "ocr-pdf", successMessage: "Your OCR download is ready", errorTitle: "OCR needs attention", onError: e => { const message = e instanceof Error ? e.message : "Try a clearer scan or another language."; setError(message); return message; } });
  };
  const downloadText = async (kind: "txt" | "docx") => {
    if (!result || exporting) return; const id = generation.current; setExporting(true); setError("");
    try { const blob = await exportOcrResult(result.recognizedText, kind); if (id === generation.current) downloadBlob(blob, `${result.base}_recognized.${kind}`); }
    catch { if (id === generation.current) setError(__copy("Could not prepare the text download. Please retry.")); } finally { if (id === generation.current) setExporting(false); }
  };
  const previewFile = useMemo(() => result ? new File([result.blob], `${result.base}_searchable.pdf`, { type: "application/pdf" }) : null, [result]);
  const selectedPages = (() => { try { return pageCount ? ocrPages(pages, pageCount).length : 0; } catch { return 0; } })();
  const matching = OCR_LANGUAGES.filter(([code, label]) => `${code} ${label}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const noTextPages = result?.pageResults.filter(p => !p.text).map(p => p.page) ?? [];
  return <FileToolLayout toolSlug="ocr-pdf" files={loading ? [pending] : [file]} onFilesSelected={choose} accept={{ "application/pdf": [".pdf"] }} result={result} processing={processing || loading} progress={loading ? undefined : progress} onCancel={stop} onReset={reset} onDownload={() => { if (result) downloadBlob(result.primary, result.filename); }} landingError={error} faqs={[]} related={[]}>
    {result ? <div className="space-y-5"><h2 className="text-center text-2xl font-bold">{""}<UiText text={"Your OCR result is ready"} />{""}</h2><p className="text-center text-sm">{""}<UiText text={"Recognized"} />{" "}{result.processedPages.length} {""}<UiText text={"of"} />{" "}{result.pageCount} {""}<UiText text={"pages. All original pages remain in the PDF."} />{""}</p><p className="text-center text-xs text-muted-foreground">{result.languages.map(id => OCR_LANGUAGES.find(([code]) => code === id)?.[1]).join(" · ")}</p>
      <div className="flex flex-wrap justify-center gap-2"><Button onClick={() => downloadBlob(result.blob, `${result.base}_searchable.pdf`)}>{""}<UiText text={"Download searchable PDF"} />{""}</Button><Button variant="outline" disabled={exporting} onClick={() => void downloadText("txt")}>{""}<UiText text={"Download TXT"} />{""}</Button><Button variant="outline" disabled={exporting} onClick={() => void downloadText("docx")}>{""}<UiText text={"Download DOCX"} />{""}</Button></div>
      {noTextPages.length > 0 && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{""}<UiText text={"No text was recognized on pages"} />{" "}{noTextPages.join(", ")}{""}<UiText text={". These pages remain unchanged in the PDF."} />{""}</p>}
      <label className="block text-sm font-medium">{""}<UiText text={"Recognized text"} />{""}<textarea readOnly dir="auto" value={result.recognizedText} className={`${fieldClass} min-h-64 font-mono`} /></label><div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(result.recognizedText); setCopied(true); } catch { setError(__copy("Copy is unavailable. Select the text above or download TXT.")); } }}>{copied ? <UiText text={"Copied"} /> : <UiText text={"Copy text"} />}</Button><span className="text-xs text-muted-foreground">{""}<UiText text={"PDF:"} />{" "}{formatFileSize(result.blob.size)}</span></div>
      <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">{""}<UiText text={"Page recognition details"} />{""}</summary><ul className="mt-3 max-h-60 space-y-2 overflow-auto text-sm">{result.pageResults.map(p => <li key={p.page}>{""}<UiText text={"Page"} />{" "}{p.page}: {p.words} {""}<UiText text={"words ·"} />{" "}{Math.round(p.confidence)}{""}<UiText text={"% recognition confidence"} />{""}{p.text && p.confidence < 70 ? <UiText text={" — review carefully"} /> : ""}</li>)}</ul><p className="mt-3 text-xs text-muted-foreground">{""}<UiText text={"Confidence is an OCR estimate, not a guarantee of accuracy."} />{""}</p></details>
      <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">{""}<UiText text={"Preview searchable PDF"} />{""}</summary>{previewFile && <SourceFilePreview file={previewFile} />}</details>
      <p className="text-sm text-muted-foreground">{""}<UiText text={"Review recognized text before relying on it. TXT and DOCX contain text, not the original page layout. OCR does not translate the document."} />{""}</p>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-center gap-3"><Button variant="outline" onClick={() => { setResult(null); setError(""); }}>{""}<UiText text={"Adjust options"} />{""}</Button><Button variant="outline" onClick={reset}>{""}<UiText text={"Start over"} />{""}</Button></div>
    </div> : <div className="space-y-5"><h2 className="text-xl font-bold">{""}<UiText text={"Make text searchable"} />{""}</h2><p className="text-sm text-muted-foreground">{pageCount} {""}<UiText text={"pages · Original page content stays intact."} />{""}</p>
      <fieldset className="space-y-3"><legend className="text-sm font-semibold">{""}<UiText text={"Document languages ("} />{""}{languages.length}/3)</legend><p className="text-xs text-muted-foreground">{""}<UiText text={"Choose the languages actually printed on the page. Fewer languages usually recognize faster and more accurately."} />{""}</p>
        <input aria-label={__copy("Search OCR languages")} placeholder={__copy("Search 41 languages…")} value={search} onChange={e => setSearch(e.target.value)} className={fieldClass} />
        <div className="flex flex-wrap gap-2">{languages.map(id => <button key={id} onClick={() => setLanguages(languages.filter(value => value !== id))} className="rounded-full bg-orange-50 px-3 py-1 text-xs text-orange-900" aria-label={__copy("Remove {0}", [OCR_LANGUAGES.find(([code]) => code === id)?.[1]])}>{OCR_LANGUAGES.find(([code]) => code === id)?.[1]} ×</button>)}</div>
        <div className="max-h-48 space-y-1 overflow-auto rounded-xl border p-2">{matching.map(([code, name]) => <label key={code} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted"><input type="checkbox" checked={languages.includes(code)} disabled={!languages.includes(code) && languages.length >= 3} onChange={e => setLanguages(e.target.checked ? [...languages, code] : languages.filter(id => id !== code))} />{name}</label>)}{!matching.length && <p className="p-2 text-sm text-muted-foreground">{""}<UiText text={"No matching language."} />{""}</p>}</div>
      </fieldset>
      <label className="block text-sm font-medium">{""}<UiText text={"Pages to recognize"} />{""}<input placeholder={__copy("All pages, or 1-3, 5")} value={pages} onChange={e => setPages(e.target.value)} className={fieldClass} /><span className="mt-1 block text-xs font-normal text-muted-foreground">{selectedPages ? <UiText text={"{0} selected"} values={[selectedPages]} /> : <UiText text={"Enter a valid page selection"} />} {""}<UiText text={"· Up to 200 pages per run. Other pages remain unchanged."} />{""}</span></label>
      <label className="block text-sm font-medium">{""}<UiText text={"Scan resolution"} />{""}<select value={dpi} onChange={e => setDpi(Number(e.target.value))} className={fieldClass}><option value={150}>{""}<UiText text={"Standard — 150 DPI"} />{""}</option><option value={300}>{""}<UiText text={"Fine print — 300 DPI"} />{""}</option></select><span className="mt-1 block text-xs font-normal text-muted-foreground">{""}<UiText text={"Higher resolution is slower. Large pages are reduced to fit available browser processing limits."} />{""}</span></label>
      <label className="block text-sm font-medium">{""}<UiText text={"Automatic download"} />{""}<select value={format} onChange={e => setFormat(e.target.value as Format)} className={fieldClass}><option value="pdf">{""}<UiText text={"Searchable PDF"} />{""}</option><option value="txt">{""}<UiText text={"Plain text (.txt)"} />{""}</option><option value="docx">{""}<UiText text={"Editable text (.docx)"} />{""}</option></select></label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <Button size="lg" className="w-full" onClick={execute}>{""}<UiText text={"Recognize text"} />{""}</Button><p className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-950">{""}<UiText text={"Your file stays in this browser. Language data loads on the first run. Printed, upright text works best; handwriting and complex layouts need careful review."} />{""}</p>
    </div>}
  </FileToolLayout>;
}
