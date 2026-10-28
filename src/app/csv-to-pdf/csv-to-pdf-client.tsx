"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, FileText } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { parseCsv } from "@/lib/engines/text-engine";
import { renderTableToPdf } from "@/lib/engines/pdf-text-renderer";
import type { ResolvedEntity } from "@/lib/content/registry";

interface CsvToPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function CsvToPdfClient({ faqs, related }: CsvToPdfClientProps) {
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
        const rows = parseCsv(text);

        if (rows.length === 0) {
          throw new Error("This file doesn't contain any rows to convert.");
        }

        const blob = await renderTableToPdf(rows, { onProgress: setProgress });
        setResultPdf(blob);
      },
      {
        successMessage: "Converted to PDF successfully!",
        toolName: "csv-to-pdf",
        errorTitle: "Failed to convert to PDF",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid .csv file",
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
    <FileToolLayout toolSlug="csv-to-pdf" files={[file]}
      accept={{ "text/csv": [".csv"] }} multiple={false} onFilesSelected={handleFilesSelected}
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
                  This renders your CSV as a ruled table with equal-width columns. The first row
                  is treated as a header and repeated on every page. Cell text that&apos;s too long
                  for its column is truncated with an ellipsis rather than wrapped.
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
