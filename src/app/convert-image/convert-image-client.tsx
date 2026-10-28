"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, ImageIcon } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { convertImageFormat, type OutputImageFormat } from "@/lib/engines/image-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface ConvertImageClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

const FORMAT_OPTIONS: { value: OutputImageFormat; label: string; extension: string }[] = [
  { value: "image/jpeg", label: "JPG", extension: "jpg" },
  { value: "image/png", label: "PNG", extension: "png" },
  { value: "image/webp", label: "WEBP", extension: "webp" },
];

export function ConvertImageClient({ faqs, related }: ConvertImageClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<OutputImageFormat>("image/png");
  const [resultImage, setResultImage] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultImage(null);
    }
  };

  const convert = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultImage(null);
        const blob = await convertImageFormat(file, format, format === "image/png" ? undefined : 0.92);
        setProgress(100);
        setResultImage(blob);
      },
      {
        successMessage: "Image converted successfully!",
        toolName: "convert-image",
        errorTitle: "Failed to convert image",
        onError: (error) => {
          console.error("Error converting image:", error);
          return error instanceof Error ? error.message : "Please try again with a valid image file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!resultImage) return;
    const extension = FORMAT_OPTIONS.find((f) => f.value === format)?.extension ?? "png";
    downloadBlob(resultImage, `converted.${extension}`);
  };

  const clear = () => {
    setFile(null);
    setResultImage(null);
  };

  return (
    <FileToolLayout toolSlug="convert-image" files={[file]}
      accept={{ "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={resultImage} processing={processing}
      progress={progress}
      onDownload={downloadResult} onReset={clear} faqs={faqs} related={related}>

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

                <div className="space-y-2">
                  <label htmlFor="output-format" className="text-sm font-medium">
                    Convert to
                  </label>
                  <div className="flex gap-2">
                    {FORMAT_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={format === option.value ? "default" : "outline"}
                        onClick={() => setFormat(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Converting image" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convert} disabled={processing}>
                    Convert Image
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {resultImage && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Image converted successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download Image
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Convert Another Image
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
