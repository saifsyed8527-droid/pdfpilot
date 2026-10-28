"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getPdfPageCount, insertPdfPages } from "@/lib/engines/pdf-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface InsertPagesClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function InsertPagesClient({ faqs, related }: InsertPagesClientProps) {
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [targetPageCount, setTargetPageCount] = useState<number>(0);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [position, setPosition] = useState<string>("");
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleTargetSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const selected = newFiles[0];
    setTargetFile(selected);
    setResultPdf(null);

    try {
      const count = await getPdfPageCount(selected);
      setTargetPageCount(count);
      setPosition(String(count));
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF", {
        description: "Please try again with a valid PDF file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      setTargetFile(null);
    }
  };

  const handleSourceSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setSourceFile(newFiles[0]);
      setResultPdf(null);
    }
  };

  const insertPages = () => {
    if (!targetFile || !sourceFile) return;

    run(
      async (setProgress) => {
        setResultPdf(null);
        const atIndex = Number(position);
        if (!Number.isInteger(atIndex) || atIndex < 0 || atIndex > targetPageCount) {
          throw new Error(`Position must be a whole number between 0 and ${targetPageCount}.`);
        }

        const blob = await insertPdfPages(targetFile, sourceFile, atIndex);
        setProgress(100);
        setResultPdf(blob);
      },
      {
        successMessage: "Pages inserted successfully!",
        toolName: "insert-pages",
        errorTitle: "Failed to insert pages",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with valid files",
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "inserted-pages.pdf");
  };

  const clear = () => {
    setTargetFile(null);
    setSourceFile(null);
    setPosition("");
    setResultPdf(null);
  };

  return (
    <FileToolLayout toolSlug="insert-pages" files={[targetFile, sourceFile]}
      accept={{ "application/pdf": [".pdf"] }} multiple={false} onFilesSelected={handleTargetSelected}
      result={resultPdf} processing={processing}
      progress={progress}
      onDownload={downloadResult} onReset={clear} faqs={faqs} related={related}>
            {!targetFile && !resultPdf && (
              <>
                <p className="text-sm text-muted-foreground">
                  Step 1: upload the PDF you want to insert pages into.
                </p>
              </>
            )}

            {targetFile && !resultPdf && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{targetFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(targetFile.size / 1024 / 1024).toFixed(2)} MB • {targetPageCount} pages
                    </p>
                  </div>
                </div>

                {!sourceFile ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Step 2: upload the PDF whose pages you want to insert.
                    </p>
                    <FileUpload
                      accept={{ "application/pdf": [".pdf"] }}
                      multiple={false}
                      onFilesSelected={handleSourceSelected}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{sourceFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(sourceFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="insert-position" className="text-sm font-medium">
                        Insert after page (0 = insert at the very start, {targetPageCount} = insert at the end)
                      </label>
                      <input
                        id="insert-position"
                        type="number"
                        min={0}
                        max={targetPageCount}
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      />
                    </div>

                    {processing && (
                      <Progress value={progress} className="h-2" aria-label="Inserting pages" />
                    )}

                    <div className="flex gap-4 flex-wrap">
                      <Button size="lg" onClick={insertPages} disabled={processing || position === ""}>
                        Insert Pages
                      </Button>
                      <Button variant="outline" onClick={clear} disabled={processing}>
                        Clear
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}

            {resultPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Pages inserted successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Insert Into Another PDF
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
