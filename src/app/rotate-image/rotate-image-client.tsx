"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, ImageIcon, RotateCw, FlipHorizontal, FlipVertical } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  rotateAndFlipImage,
  preferredOutputFormat,
  type RotationDegrees,
  type OutputImageFormat,
} from "@/lib/engines/image-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface RotateImageClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

const EXTENSION_BY_FORMAT: Record<OutputImageFormat, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function RotateImageClient({ faqs, related }: RotateImageClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rotate, setRotate] = useState<RotationDegrees | 0>(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFormat, setResultFormat] = useState<OutputImageFormat>("image/png");
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setRotate(0);
      setFlipHorizontal(false);
      setFlipVertical(false);
      setResultBlob(null);
    }
  };

  const cycleRotation = () => {
    setRotate((current) => (current === 0 ? 90 : current === 90 ? 180 : current === 180 ? 270 : 0));
  };

  const apply = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultBlob(null);
        const format = preferredOutputFormat(file);
        const blob = await rotateAndFlipImage(
          file,
          { rotate: rotate === 0 ? undefined : rotate, flipHorizontal, flipVertical },
          format
        );
        setProgress(100);
        setResultFormat(format);
        setResultBlob(blob);
      },
      {
        successMessage: "Image updated successfully!",
        toolName: "rotate-image",
        errorTitle: "Failed to rotate image",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid image file",
      }
    );
  };

  const downloadResult = () => {
    if (!resultBlob) return;
    downloadBlob(resultBlob, `rotated-image.${EXTENSION_BY_FORMAT[resultFormat]}`);
  };

  const clear = () => {
    setFile(null);
    setRotate(0);
    setFlipHorizontal(false);
    setFlipVertical(false);
    setResultBlob(null);
  };

  return (
    <FileToolLayout toolSlug="rotate-image" files={[file]}
      accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"], "image/gif": [".gif"], "image/bmp": [".bmp"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={resultBlob} processing={processing}
      progress={progress}
      onDownload={downloadResult} onReset={clear} faqs={faqs} related={related}>

            {file && !resultBlob && (
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

                <div className="flex gap-3 flex-wrap">
                  <Button variant="outline" onClick={cycleRotation}>
                    <RotateCw className="h-4 w-4 mr-2" />
                    Rotate 90° ({rotate}°)
                  </Button>
                  <Button
                    variant={flipHorizontal ? "default" : "outline"}
                    onClick={() => setFlipHorizontal((v) => !v)}
                  >
                    <FlipHorizontal className="h-4 w-4 mr-2" />
                    Flip Horizontal
                  </Button>
                  <Button
                    variant={flipVertical ? "default" : "outline"}
                    onClick={() => setFlipVertical((v) => !v)}
                  >
                    <FlipVertical className="h-4 w-4 mr-2" />
                    Flip Vertical
                  </Button>
                </div>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Applying changes" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button
                    size="lg"
                    onClick={apply}
                    disabled={processing || (rotate === 0 && !flipHorizontal && !flipVertical)}
                  >
                    Apply
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {resultBlob && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Image updated successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download Image
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Edit Another Image
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
