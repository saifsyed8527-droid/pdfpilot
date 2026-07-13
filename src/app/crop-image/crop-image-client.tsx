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
import {
  cropImage,
  getImageDimensions,
  preferredOutputFormat,
  type OutputImageFormat,
} from "@/lib/engines/image-engine";

const EXTENSION_BY_FORMAT: Record<OutputImageFormat, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface CropImageClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function CropImageClient({ faqs, related }: CropImageClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [region, setRegion] = useState({ x: "0", y: "0", width: "", height: "" });
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFormat, setResultFormat] = useState<OutputImageFormat>("image/png");
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const selected = newFiles[0];
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setResultBlob(null);

    try {
      const dims = await getImageDimensions(selected);
      setDimensions(dims);
      setRegion({ x: "0", y: "0", width: String(dims.width), height: String(dims.height) });
    } catch (error) {
      console.error("Error reading image:", error);
      toast.error("Failed to read image", {
        description: "Please try again with a valid image file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      setFile(null);
    }
  };

  const crop = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultBlob(null);
        const x = Number(region.x);
        const y = Number(region.y);
        const width = Number(region.width);
        const height = Number(region.height);

        if (
          !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) ||
          width <= 0 || height <= 0 || x < 0 || y < 0 ||
          x + width > dimensions.width || y + height > dimensions.height
        ) {
          throw new Error(
            `Crop region must fit inside the ${dimensions.width}×${dimensions.height} image.`
          );
        }

        setProgress(30);
        const format = preferredOutputFormat(file);
        const blob = await cropImage(file, { x, y, width, height }, format);
        setProgress(100);
        setResultFormat(format);
        setResultBlob(blob);
      },
      {
        successMessage: "Image cropped successfully!",
        toolName: "crop-image",
        errorTitle: "Failed to crop image",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid crop region",
      }
    );
  };

  const downloadResult = () => {
    if (!resultBlob) return;
    downloadBlob(resultBlob, `cropped-image.${EXTENSION_BY_FORMAT[resultFormat]}`);
  };

  const clear = () => {
    setFile(null);
    setPreviewUrl(null);
    setDimensions({ width: 0, height: 0 });
    setRegion({ x: "0", y: "0", width: "", height: "" });
    setResultBlob(null);
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
              <h1>Crop Image</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !resultBlob && (
              <FileUpload
                accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"], "image/gif": [".gif"], "image/bmp": [".bmp"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !resultBlob && (
              <>
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Preview of the uploaded image to be cropped"
                    className="max-h-80 mx-auto rounded-lg border"
                  />
                )}

                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <ImageIcon className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {dimensions.width}×{dimensions.height}px
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="crop-x" className="text-sm font-medium">X (px from left)</label>
                    <input
                      id="crop-x"
                      type="number"
                      min={0}
                      value={region.x}
                      onChange={(e) => setRegion({ ...region, x: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="crop-y" className="text-sm font-medium">Y (px from top)</label>
                    <input
                      id="crop-y"
                      type="number"
                      min={0}
                      value={region.y}
                      onChange={(e) => setRegion({ ...region, y: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="crop-width" className="text-sm font-medium">Width (px)</label>
                    <input
                      id="crop-width"
                      type="number"
                      min={1}
                      value={region.width}
                      onChange={(e) => setRegion({ ...region, width: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="crop-height" className="text-sm font-medium">Height (px)</label>
                    <input
                      id="crop-height"
                      type="number"
                      min={1}
                      value={region.height}
                      onChange={(e) => setRegion({ ...region, height: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                </div>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Cropping image" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={crop} disabled={processing}>
                    Crop Image
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
                <h3 className="text-xl font-semibold">Image cropped successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download Image
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Crop Another Image
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
