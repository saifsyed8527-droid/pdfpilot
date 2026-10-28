"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, FileText } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { parseMarkdownToBlocks } from "@/lib/engines/text-engine";
import { renderBlocksToPdf } from "@/lib/engines/pdf-text-renderer";
import type { ResolvedEntity } from "@/lib/content/registry";

interface MarkdownToPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function MarkdownToPdfClient({ faqs, related }: MarkdownToPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultPdf(null);
    }
  };

  const convertToPdf = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultPdf(null);
        const text = await file.text();
        const blocks = await parseMarkdownToBlocks(text);

        if (blocks.length === 0) {
          throw new Error("No headings or paragraphs could be extracted from this file.");
        }

        const blob = await renderBlocksToPdf(blocks, { onProgress: setProgress });
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
    downloadBlob(resultPdf, "converted.pdf");
  };

  const clear = () => {
    setFile(null);
    setResultPdf(null);
  };

  return (
    <FileToolLayout toolSlug="markdown-to-pdf" files={[file]}
      accept={{ "text/markdown": [".md", ".markdown"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={resultPdf} processing={processing}
      progress={progress}
      onDownload={downloadResult} onReset={clear} faqs={faqs} related={related}>

            {file && !resultPdf && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  This converts headings and paragraphs into a clean PDF — lists, tables, links,
                  images, and code blocks aren&apos;t preserved.
                </p>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Converting to PDF" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convertToPdf} disabled={processing}>
                    Convert to PDF
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
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
