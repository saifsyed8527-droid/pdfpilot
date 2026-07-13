"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, ImageIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { convertImageFormat, preferredOutputFormat } from "@/lib/engines/image-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface CompressImageClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function CompressImageClient({ faqs, related }: CompressImageClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.8);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const isLosslessFormat = file?.type === "image/png";

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultBlob(null);
    }
  };

  const compress = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultBlob(null);
        setProgress(30);
        // PNG is always lossless in canvas — re-encoding it can't shrink it via
        // a quality knob, so PNGs are converted to JPEG instead, the same
        // honest tradeoff every browser-based image compressor makes.
        const format = isLosslessFormat ? "image/jpeg" : preferredOutputFormat(file);
        const blob = await convertImageFormat(file, format, quality);
        setProgress(100);
        setResultBlob(blob);
      },
      {
        successMessage: "Image compressed successfully!",
        toolName: "compress-image",
        errorTitle: "Failed to compress image",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid image file",
      }
    );
  };

  const downloadResult = () => {
    if (!resultBlob) return;
    const extension = isLosslessFormat ? "jpg" : file?.type === "image/webp" ? "webp" : "jpg";
    downloadBlob(resultBlob, `compressed-image.${extension}`);
  };

  const clear = () => {
    setFile(null);
    setQuality(0.8);
    setResultBlob(null);
  };

  const savings =
    resultBlob && file ? Math.round((1 - resultBlob.size / file.size) * 100) : null;

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
              <h1>Compress Image</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !resultBlob && (
              <FileUpload
                accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

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

                {isLosslessFormat && (
                  <p className="text-sm text-muted-foreground">
                    PNG is a lossless format and can&apos;t be shrunk with a quality setting — this will
                    convert your image to JPG to actually reduce file size.
                  </p>
                )}

                <div className="space-y-2">
                  <label htmlFor="quality" className="text-sm font-medium">
                    Quality: {Math.round(quality * 100)}%
                  </label>
                  <input
                    id="quality"
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower quality means a smaller file but more visible compression artifacts.
                  </p>
                </div>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Compressing image" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={compress} disabled={processing}>
                    Compress Image
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
                <h3 className="text-xl font-semibold">Image compressed successfully!</h3>
                {savings !== null && (
                  <p className="text-muted-foreground">
                    {savings > 0
                      ? `${savings}% smaller (${(resultBlob.size / 1024 / 1024).toFixed(2)} MB)`
                      : `New size: ${(resultBlob.size / 1024 / 1024).toFixed(2)} MB`}
                  </p>
                )}
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download Image
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Compress Another Image
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
