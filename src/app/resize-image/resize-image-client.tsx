"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, ImageIcon, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getImageDimensions, resizeImage } from "@/lib/engines/image-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

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
        setProgress(30);
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
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>Resize Image</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !resultImage && (
              <FileUpload
                accept={{ "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

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
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle asChild className="text-xl md:text-2xl"><h2>Frequently Asked Questions</h2></CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="font-semibold mb-1">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <ToolRelatedContent items={related} />
      </div>
    </div>
  );
}
