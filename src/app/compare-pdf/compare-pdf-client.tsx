"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileText } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { useProcessingTask } from "@/lib/use-processing-task";
import { comparePdfText, type PdfTextDiffSegment } from "@/lib/pdf-text-extraction";
import type { ResolvedEntity } from "@/lib/content/registry";

interface ComparePdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function ComparePdfClient({ faqs, related }: ComparePdfClientProps) {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [diff, setDiff] = useState<PdfTextDiffSegment[] | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFileASelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFileA(newFiles[0]);
      setDiff(null);
    }
  };

  const handleFileBSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFileB(newFiles[0]);
      setDiff(null);
    }
  };

  const compare = () => {
    if (!fileA || !fileB) return;

    run(
      async (setProgress) => {
        setDiff(null);
        const result = await comparePdfText(fileA, fileB);
        setProgress(100);
        setDiff(result);
      },
      {
        successMessage: "PDFs compared successfully!",
        toolName: "compare-pdf",
        errorTitle: "Failed to compare PDFs",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with valid PDF files",
      }
    );
  };

  const clear = () => {
    setFileA(null);
    setFileB(null);
    setDiff(null);
  };

  const hasChanges = diff?.some((segment) => segment.added || segment.removed) ?? false;

  return (
    <FileToolLayout toolSlug="compare-pdf" files={[fileA, fileB]}
      accept={{ "application/pdf": [".pdf"] }} multiple={false} onFilesSelected={handleFileASelected}
      result={diff} processing={processing}
      progress={progress} onReset={clear} faqs={faqs} related={related}>
            {!diff && (
              <>
                <p className="text-sm text-muted-foreground">
                  Compares the text content of two PDFs and highlights what changed. This is a
                  text comparison, not a visual one — formatting, images, and exact layout aren&apos;t
                  compared.
                </p>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Original PDF</p>
                    {fileA ? (
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <FileText className="h-6 w-6 text-primary shrink-0" />
                        <p className="text-sm font-medium truncate">{fileA.name}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Revised PDF</p>
                    {fileB ? (
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <FileText className="h-6 w-6 text-primary shrink-0" />
                        <p className="text-sm font-medium truncate">{fileB.name}</p>
                      </div>
                    ) : (
                      <FileUpload
                        accept={{ "application/pdf": [".pdf"] }}
                        multiple={false}
                        onFilesSelected={handleFileBSelected}
                      />
                    )}
                  </div>
                </div>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Comparing PDFs" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={compare} disabled={processing || !fileA || !fileB}>
                    Compare PDFs
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {diff && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">
                  {hasChanges ? "Differences found" : "No text differences found"}
                </h3>
                <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm leading-relaxed max-h-[32rem] overflow-y-auto">
                  {diff.map((segment, index) => (
                    <span
                      key={index}
                      className={
                        segment.added
                          ? "bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-200"
                          : segment.removed
                            ? "bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-200 line-through"
                            : undefined
                      }
                    >
                      {segment.value}
                    </span>
                  ))}
                </div>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button variant="outline" onClick={clear}>
                    Compare Another Pair
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
