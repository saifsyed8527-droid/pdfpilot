"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Loader2 } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { loadPdfjs } from "@/lib/pdfjs";
import { Button } from "@/components/ui/button";

function PdfSourcePreview({ file }: { file: File }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let disposed = false;
    let loading: PDFDocumentLoadingTask | undefined;
    setDocument(null);
    setPageNumber(1);
    setError("");
    setRendering(true);
    void (async () => {
      try {
        const [pdfjs, data] = await Promise.all([loadPdfjs(), file.arrayBuffer()]);
        if (disposed) return;
        loading = pdfjs.getDocument({ data, cMapUrl: "/pdfjs-assets/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs-assets/standard_fonts/", wasmUrl: "/pdfjs-assets/wasm/" });
        const pdf = await loading.promise;
        if (!disposed) setDocument(pdf);
      } catch (cause) {
        if (!disposed) {
          setError(cause instanceof Error && cause.name === "PasswordException"
            ? "This PDF is password protected. Use the tool’s password controls to continue."
            : "A preview could not be loaded. You can still try processing this file.");
          setRendering(false);
        }
      }
    })();
    return () => { disposed = true; void loading?.destroy(); };
  }, [file]);

  useEffect(() => {
    if (!document) return;
    let disposed = false;
    let task: RenderTask | undefined;
    setRendering(true);
    void (async () => {
      try {
        const page = await document.getPage(Math.min(pageNumber, document.numPages));
        const canvas = canvasRef.current;
        if (disposed || !canvas) return;
        const natural = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(1.5, 1000 / natural.width, 1400 / natural.height) });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        task = page.render({ canvas, viewport });
        await task.promise;
        if (!disposed) { setRendering(false); setError(""); }
        page.cleanup();
      } catch {
        if (!disposed) { setError("This page cannot be previewed."); setRendering(false); }
      }
    })();
    return () => { disposed = true; task?.cancel(); };
  }, [document, pageNumber]);

  return (
    <div className="space-y-4">
      <div className="relative flex min-h-80 items-center justify-center rounded-2xl bg-slate-100 p-4 dark:bg-slate-950">
        {rendering && <span role="status" className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-100/90 text-sm dark:bg-slate-950/90"><Loader2 className="h-5 w-5 animate-spin" />Loading preview…</span>}
        {error && <p className="max-w-sm text-center text-sm leading-6 text-muted-foreground">{error}</p>}
        <canvas ref={canvasRef} aria-label={`Preview of page ${pageNumber}`} className={`${error ? "hidden" : "block"} h-auto max-h-[65vh] max-w-full bg-white shadow-md`} />
      </div>
      {document && <div className="flex items-center justify-center gap-4">
        <Button type="button" variant="outline" size="icon" aria-label="Previous page" disabled={pageNumber === 1 || rendering} onClick={() => setPageNumber(value => value - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm tabular-nums">Page {pageNumber} of {document.numPages}</span>
        <Button type="button" variant="outline" size="icon" aria-label="Next page" disabled={pageNumber >= document.numPages || rendering} onClick={() => setPageNumber(value => value + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>}
    </div>
  );
}

function ImageSourcePreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    setFailed(false);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  return failed ? <FilePlaceholder file={file} message="Your browser cannot preview this image format. The selected file is ready for conversion." /> : (
    <div className="flex min-h-80 items-center justify-center rounded-2xl bg-slate-100 p-5 dark:bg-slate-950">
      {/* Local object URLs avoid transmitting the image to an optimization server. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={`Original: ${file.name}`} onError={() => setFailed(true)} className="max-h-[65vh] max-w-full object-contain shadow-sm" />}
    </div>
  );
}

function FilePlaceholder({ file, message }: { file: File; message?: string }) {
  return <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl bg-slate-100 p-8 text-center dark:bg-slate-950">
    <FileText className="h-20 w-20 text-slate-400" aria-hidden />
    <p className="break-all font-semibold">{file.name}</p>
    <p className="max-w-sm text-sm leading-6 text-muted-foreground">{message ?? "Your file is ready. Choose the options and continue to create the output."}</p>
  </div>;
}

function TextSourcePreview({ file }: { file: File }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setText(null); setFailed(false);
    void file.slice(0, 48000).text().then(value => { if (active) setText(value); }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [file]);
  if (failed) return <FilePlaceholder file={file} message="Text preview is unavailable. You can still try processing the selected file." />;
  return <div className="overflow-hidden rounded-2xl border bg-white dark:bg-slate-950">
    <pre tabIndex={0} aria-label="Source file preview" className="max-h-[65vh] min-h-72 overflow-auto whitespace-pre-wrap break-words p-5 text-xs leading-6 [overflow-wrap:anywhere]">{text === null ? "Loading preview…" : text || "This file is empty."}</pre>
    {file.size > 48000 && <p className="border-t px-5 py-3 text-xs text-muted-foreground">Showing the first 48 KB. Processing uses the complete file.</p>}
  </div>;
}

export function SourceFilePreview({ file }: { file: File }) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf") return <PdfSourcePreview file={file} />;
  if (file.type.startsWith("image/") || ["heic", "heif", "svg"].includes(extension)) return <ImageSourcePreview file={file} />;
  if (["txt", "csv", "tsv", "json", "xml", "yaml", "yml", "md", "markdown", "html", "htm", "sql", "jwt"].includes(extension)) return <TextSourcePreview file={file} />;
  return <FilePlaceholder file={file} />;
}
