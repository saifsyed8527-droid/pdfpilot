"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, FileCode } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { convertSvgToPdf } from "@/lib/engines/pdf-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface SvgToPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function SvgToPdfClient({ faqs, related }: SvgToPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, failed, run, cancel, retry } = useProcessingTask();

  const convert = (targetFile: File) => {
    run(
      async (setProgress, isCancelled) => {
        setResultPdf(null);
        const blob = await convertSvgToPdf(targetFile);
        if (isCancelled()) return;
        setProgress(100);
        setResultPdf(blob);
      },
      {
        successMessage: "SVG converted to PDF successfully!",
        toolName: "svg-to-pdf",
        errorTitle: "Failed to convert SVG",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid SVG file",
      }
    );
  };

  // No configuration exists for this tool - selecting a file is the only
  // decision, so conversion starts immediately instead of a second click.
  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      const selected = newFiles[0];
      setFile(selected);
      setResultPdf(null);
      convert(selected);
    }
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
    <FileToolLayout toolSlug="svg-to-pdf" files={[file]}
      accept={{ "image/svg+xml": [".svg"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={resultPdf} processing={processing}
      progress={progress}
      onDownload={downloadResult} onReset={clear} onCancel={cancel} faqs={faqs} related={related}>

            {file && !resultPdf && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileCode className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  This creates a PDF containing your SVG rendered as a high-resolution image.
                  It&apos;s not a vector conversion — text and shapes in the output PDF are
                  pixels, not editable paths.
                </p>

                {processing && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground/80">
                      {progress >= 100 ? "Almost done…" : "Processing…"}
                    </p>
                    <Progress value={progress} className="h-2" aria-label="Converting SVG to PDF" />
                  </div>
                )}

                <div className="flex gap-4 flex-wrap">
                  {processing ? (
                    <Button variant="outline" onClick={cancel}>
                      Cancel
                    </Button>
                  ) : failed ? (
                    <>
                      <Button size="lg" onClick={retry}>
                        Try Again
                      </Button>
                      <Button variant="outline" onClick={clear}>
                        Clear
                      </Button>
                    </>
                  ) : (
                    <>
                    <Button size="lg" onClick={() => convert(file)}>Convert to PDF</Button>
                    <Button variant="outline" onClick={clear}>
                      Clear
                    </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {resultPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Your file is ready</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button variant="outline" size="lg" onClick={clear}>
                    Process another file
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
