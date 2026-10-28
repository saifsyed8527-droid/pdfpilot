"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, ImageIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getImageDimensions, resizeImage } from "@/lib/engines/image-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface ResizeImageClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function ResizeImageClient({ faqs, related }: ResizeImageClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [resultImage, setResultImage] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const selected = newFiles[0];
    setFile(selected);
    setResultImage(null);

    try {
      const dims = await getImageDimensions(selected);
      setOriginalDimensions(dims);
      setWidth(String(dims.width));
      setHeight(String(dims.height));
    } catch (error) {
      console.error("Error reading image dimensions:", error);
      toast.error("Failed to read image", {
        description: "Please try again with a valid image file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      setFile(null);
    }
  };

  const resize = () => {
    if (!file) return;
    const targetWidth = width ? Number(width) : undefined;
    const targetHeight = height ? Number(height) : undefined;

    run(
      async (setProgress) => {
        setResultImage(null);
        if (!targetWidth && !targetHeight) {
          throw new Error("Enter a width or height to resize to.");
        }
        const blob = await resizeImage(
          file,
          { width: targetWidth, height: targetHeight, maintainAspectRatio },
          "image/png"
        );
        setProgress(100);
        setResultImage(blob);
      },
      {
        successMessage: "Image resized successfully!",
        toolName: "resize-image",
        errorTitle: "Failed to resize image",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with valid dimensions",
      }
    );
  };

  const downloadResult = () => {
    if (!resultImage) return;
    downloadBlob(resultImage, "resized.png");
  };

  const clear = () => {
    setFile(null);
    setOriginalDimensions(null);
    setWidth("");
    setHeight("");
    setResultImage(null);
  };

  return (
    <FileToolLayout toolSlug="resize-image" files={[file]}
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
                      {originalDimensions && ` • ${originalDimensions.width} × ${originalDimensions.height}px`}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="resize-width" className="text-sm font-medium">Width (px)</label>
                    <input
                      id="resize-width"
                      type="number"
                      min={1}
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="resize-height" className="text-sm font-medium">Height (px)</label>
                    <input
                      id="resize-height"
                      type="number"
                      min={1}
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={maintainAspectRatio}
                    onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Maintain aspect ratio
                </label>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Resizing image" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={resize} disabled={processing}>
                    Resize Image
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
                <h3 className="text-xl font-semibold">Image resized successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download Image
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Resize Another Image
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
