"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getPdfPageCount, duplicatePdfPages } from "@/lib/engines/pdf-engine";
import { parsePageRanges, expandPageRanges } from "@/lib/pdf-page-ranges";
import type { ResolvedEntity } from "@/lib/content/registry";

interface DuplicatePagesClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function DuplicatePagesClient({ faqs, related }: DuplicatePagesClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [pagesToDuplicate, setPagesToDuplicate] = useState<string>("");
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const selected = newFiles[0];
    setFile(selected);
    setPagesToDuplicate("");
    setResultPdf(null);

    try {
      setPageCount(await getPdfPageCount(selected));
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF", {
        description: "Please try again with a valid PDF file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      setFile(null);
    }
  };

  const duplicatePages = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultPdf(null);
        const ranges = parsePageRanges(pagesToDuplicate);
        const pageIndices = expandPageRanges(ranges, pageCount);

        if (pageIndices.length === 0) {
          throw new Error("Enter at least one valid page number to duplicate.");
        }

        const blob = await duplicatePdfPages(file, pageIndices);
        setProgress(100);
        setResultPdf(blob);
      },
      {
        successMessage: "Pages duplicated successfully!",
        toolName: "duplicate-pages",
        errorTitle: "Failed to duplicate pages",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with valid page numbers",
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "duplicated-pages.pdf");
  };

  const clear = () => {
    setFile(null);
    setPagesToDuplicate("");
    setResultPdf(null);
  };

  return (
    <FileToolLayout toolSlug="duplicate-pages" files={[file]}
      accept={{ "application/pdf": [".pdf"] }} multiple={false} onFilesSelected={handleFilesSelected}
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
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {pageCount} pages
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="pages-to-duplicate" className="text-sm font-medium">
                    Pages to duplicate (e.g., 2,4-6)
                  </label>
                  <input
                    id="pages-to-duplicate"
                    type="text"
                    value={pagesToDuplicate}
                    onChange={(e) => setPagesToDuplicate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="2,4-6"
                  />
                </div>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Duplicating pages" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={duplicatePages} disabled={processing || !pagesToDuplicate}>
                    Duplicate Pages
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
                <h3 className="text-xl font-semibold">Pages duplicated successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Duplicate From Another PDF
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
