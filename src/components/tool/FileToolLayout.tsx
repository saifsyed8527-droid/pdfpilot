"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FileText, Loader2, Plus, Upload } from "lucide-react";
import { useDropzone, type Accept } from "react-dropzone";
import { toast } from "sonner";
import { getTool } from "@/lib/tools";
import { formatFileSize } from "@/lib/utils";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";
import { RelatedTools } from "./RelatedTools";
import { getCrossSellTools } from "@/lib/cross-sell";
import { PdfToolLanding, PdfToolResultLayout, PdfWorkspaceBar } from "./PdfToolChrome";
import { SourceFilePreview } from "./SourceFilePreview";

interface FileToolLayoutProps {
  toolSlug: string;
  files: (File | null)[];
  accept: Accept;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  result: unknown;
  processing?: boolean;
  progress?: number;
  onDownload?: () => void | Promise<void>;
  onReset: () => void;
  onCancel?: () => void;
  children: ReactNode;
  preview?: ReactNode;
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

/** Uses the existing Merge/Split chrome; processing remains owned by each tool. */
export function FileToolLayout({ toolSlug, files: inputFiles, accept, multiple = false, onFilesSelected, result, processing = false, progress, onDownload, onReset, onCancel, children, preview, faqs, related }: FileToolLayoutProps) {
  const tool = getTool(`/${toolSlug}`)!;
  const files = inputFiles.filter((file): file is File => file !== null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedFile = files[Math.min(selectedIndex, files.length - 1)];
  const downloadedRef = useRef<unknown>(null);
  const hasResult = result !== null && result !== undefined && result !== false;
  const accent = tool.domain === "image" ? "emerald" : tool.domain === "data" ? "amber" : "orange";
  const dropzone = useDropzone({ accept, multiple, maxSize: 100 * 1024 * 1024, disabled: processing, onDropAccepted: onFilesSelected,
    onDropRejected: rejected => toast.error(rejected.some(item => item.errors.some(error => error.code === "file-too-large")) ? "Each file must be 100MB or smaller." : "Please choose a supported file.") });

  useEffect(() => {
    if (!hasResult) downloadedRef.current = null;
    if (!hasResult || processing || !onDownload || downloadedRef.current === result) return;
    downloadedRef.current = result;
    try {
      Promise.resolve(onDownload()).catch(() => toast.error("Automatic download did not start. Use the Download button to save your result."));
    } catch {
      toast.error("Automatic download did not start. Use the Download button to save your result.");
    }
  }, [hasResult, result, processing, onDownload]);

  const supportingContent = <div className="container mx-auto max-w-4xl px-4 pb-10">
    {faqs.length > 0 && <details className="rounded-3xl border bg-white p-6 dark:bg-slate-900">
      <summary className="cursor-pointer text-lg font-semibold">Help with this tool</summary>
      <div className="mt-4 divide-y">{faqs.map(faq => <details key={faq.question} className="py-4"><summary className="cursor-pointer font-medium">{faq.question}</summary><p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.answer}</p></details>)}</div>
      {related.length > 0 && <ToolRelatedContent items={related} />}
    </details>}
  </div>;

  if (processing) return <div className="flex flex-1 flex-col bg-slate-50 dark:bg-slate-950">
    <PdfWorkspaceBar title={tool.name} meta={`${files.length} ${files.length === 1 ? "file" : "files"}`} />
    <section className="mx-auto my-12 w-[calc(100%-2rem)] max-w-xl space-y-5 rounded-3xl border bg-white p-10 text-center dark:bg-slate-900" aria-busy="true">
      <Loader2 aria-hidden className="mx-auto h-10 w-10 animate-spin text-orange-500" />
      <h2 role="status" className="text-xl font-bold">Processing your {files.length === 1 ? "file" : "files"}…</h2>
      <p className="text-sm text-muted-foreground">Keep this page open while your result is prepared.</p>
      {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
      {typeof progress === "number" && progress > 0 && <Progress value={progress} aria-label="Processing progress" />}
    </section>
  </div>;

  if (hasResult) return <div className="flex flex-1 flex-col bg-slate-50/70 dark:bg-slate-950/40">
    <PdfToolResultLayout toolSlug={toolSlug} showRelated={tool.domain === "pdf"}>
      <h1 className="sr-only">{tool.name} result</h1>
      <div className="space-y-6">{children}</div>
      {onDownload && <p className="mt-5 text-center text-xs text-muted-foreground">Your download starts automatically. Use the Download button to save another copy.</p>}
      {tool.domain !== "pdf" && <RelatedTools title="Continue with your file" tools={getCrossSellTools(toolSlug)} />}
    </PdfToolResultLayout>
  </div>;

  if (!files.length) return <div className="flex flex-1 flex-col">
    <PdfToolLanding title={tool.name} description={tool.description} buttonLabel={multiple ? "Select files" : "Select file"} dropLabel="or drop files here" limitLabel="Up to 100MB per file"
      accept={accept} multiple={multiple} icon={tool.icon ?? FileText} iconClass={accent === "emerald" ? "text-emerald-600" : accent === "amber" ? "text-amber-600" : "text-orange-600"}
      iconBackgroundClass={accent === "emerald" ? "bg-emerald-100 dark:bg-emerald-950" : accent === "amber" ? "bg-amber-100 dark:bg-amber-950" : "bg-orange-100 dark:bg-orange-950"}
      accent={accent} onFilesSelected={onFilesSelected} />
    {supportingContent}
  </div>;

  return <div className="flex flex-1 flex-col bg-slate-50/70 dark:bg-slate-950/40">
    <PdfWorkspaceBar title={tool.name} meta={`${files.length} ${files.length === 1 ? "file" : "files"} · ${formatFileSize(files.reduce((size, file) => size + file.size, 0))}`}
      actions={<><Button variant="outline" onClick={onReset}>Start over</Button><Button variant="outline" onClick={dropzone.open}>{multiple ? <Plus className="me-2 h-4 w-4" /> : <Upload className="me-2 h-4 w-4" />}{multiple ? "Add files" : "Replace file"}</Button><input {...dropzone.getInputProps()} /></>} />
    <div className="container mx-auto grid w-full max-w-[1500px] min-w-0 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <section aria-label="File preview" className="min-w-0 space-y-4 rounded-3xl border bg-white p-4 shadow-sm dark:bg-slate-900 md:p-6">
        {files.length > 1 && <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Selected files">{files.map((file, index) => <button key={`${index}-${file.name}`} type="button" aria-pressed={file === selectedFile} onClick={() => setSelectedIndex(index)}
          className={`max-w-52 shrink-0 truncate rounded-lg border px-3 py-2 text-sm ${file === selectedFile ? "border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "hover:bg-muted"}`}>{index + 1}. {file.name}</button>)}</div>}
        <p className="break-all text-sm font-semibold">{selectedFile?.name}</p>
        {preview ?? (selectedFile && <SourceFilePreview key={`${selectedIndex}-${selectedFile.name}-${selectedFile.lastModified}`} file={selectedFile} />)}
      </section>
      <aside aria-label="Tool options" className="min-w-0 rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-900 lg:sticky lg:top-24">
        <h2 className="mb-5 text-lg font-bold">{tool.name}</h2>
        <div className="space-y-5 [&_button]:max-w-full [&_input]:max-w-full [&_select]:max-w-full [&_textarea]:max-w-full">{children}</div>
      </aside>
    </div>
  </div>;
}
