"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, ImageIcon } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { convertHeicTo } from "@/lib/engines/heic-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface HeicToJpgClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function HeicToJpgClient({ faqs, related }: HeicToJpgClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultImage, setResultImage] = useState<Blob | null>(null);
  const { processing, progress, failed, run, cancel, retry } = useProcessingTask();

  const convert = (targetFile: File) => {
    run(
      async (setProgress, isCancelled) => {
        setResultImage(null);
        const blob = await convertHeicTo(targetFile, "image/jpeg", 0.92);
        if (isCancelled()) return;
        setProgress(100);
        setResultImage(blob);
      },
      {
        successMessage: "HEIC converted to JPG successfully!",
        toolName: "heic-to-jpg",
        errorTitle: "Failed to convert HEIC file",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid HEIC file",
      }
    );
  };

  // No configuration exists for this tool - selecting a file is the only
  // decision, so conversion starts immediately instead of a second click.
  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      const selected = newFiles[0];
      setFile(selected);
      setResultImage(null);
      convert(selected);
    }
  };

  const downloadResult = () => {
    if (!resultImage) return;
    downloadBlob(resultImage, "converted.jpg");
  };

  const clear = () => {
    setFile(null);
    setResultImage(null);
  };

  return (
    <FileToolLayout toolSlug="heic-to-jpg" files={[file]}
      accept={{ "image/heic": [".heic"], "image/heif": [".heif"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={resultImage} processing={processing}
      progress={progress}
      onDownload={downloadResult} onReset={clear} onCancel={cancel} faqs={faqs} related={related}>

            {file && !resultImage && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <ImageIcon className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                {processing && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground/80">
                      {progress >= 100 ? "Almost done…" : "Processing…"}
                    </p>
                    <Progress value={progress} className="h-2" aria-label="Converting HEIC to JPG" />
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
                    <Button size="lg" onClick={() => convert(file)}>Convert to JPG</Button>
                    <Button variant="outline" onClick={clear}>
                      Clear
                    </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {resultImage && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Your file is ready</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download JPG
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
