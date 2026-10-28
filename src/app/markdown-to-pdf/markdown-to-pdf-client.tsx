"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, FileText } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { formatFileSize } from "@/lib/utils";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { markdownToPdf } from "@/lib/engines/markdown-pdf-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface MarkdownToPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function MarkdownToPdfClient({ faqs, related }: MarkdownToPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run, cancel } = useProcessingTask();
  const [pageSize, setPageSize] = useState<"a4" | "letter">("a4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultPdf(null);
    }
  };

  const convertToPdf = () => {
    if (!file) return;

    run(
      async (setProgress, isCancelled) => {
        setResultPdf(null);
        const text = await file.text();
        const blob = await markdownToPdf(text, { pageSize, orientation, onProgress: setProgress, isCancelled });
        if (isCancelled()) return;
        setResultPdf(blob);
      },
      {
        successMessage: "Converted to PDF successfully!",
        toolName: "markdown-to-pdf",
        errorTitle: "Failed to convert to PDF",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid Markdown file",
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, `${file?.name.replace(/\.(md|markdown)$/i, "") || "document"}.pdf`);
  };

  const clear = () => {
    setFile(null);
    setResultPdf(null);
  };

  return (
    <FileToolLayout toolSlug="markdown-to-pdf" files={[file]}
      accept={{ "text/markdown": [".md", ".markdown"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={resultPdf} processing={processing}
      progress={progress} onCancel={cancel}
      onDownload={downloadResult} onReset={clear} faqs={faqs} related={related}>

            {file && !resultPdf && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Headings, lists, tables, code, links, bold and italic text are included. Embedded PNG/JPG images are supported; remote images become labelled links. Raw HTML is printed as text.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-sm">Page size<select aria-label="Page size" value={pageSize} disabled={processing} onChange={event => setPageSize(event.target.value as "a4" | "letter")} className="h-10 w-full rounded-lg border bg-background px-2"><option value="a4">A4</option><option value="letter">Letter</option></select></label>
                  <label className="space-y-1 text-sm">Orientation<select aria-label="Orientation" value={orientation} disabled={processing} onChange={event => setOrientation(event.target.value as "portrait" | "landscape")} className="h-10 w-full rounded-lg border bg-background px-2"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
                </div>
                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Converting to PDF" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convertToPdf} disabled={processing}>
                    Convert to PDF
                  </Button>
                  <Button variant="outline" onClick={processing ? cancel : clear}>
                    {processing ? "Cancel" : "Clear"}
                  </Button>
                </div>
              </>
            )}

            {resultPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Converted to PDF successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Convert Another File
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
