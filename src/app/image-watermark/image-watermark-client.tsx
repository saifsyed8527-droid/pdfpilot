"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Download, ImageIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  addImageWatermark,
  preferredOutputFormat,
  type WatermarkPosition,
} from "@/lib/engines/image-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface ImageWatermarkClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function ImageWatermarkClient({ faqs, related }: ImageWatermarkClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("SAMPLE");
  const [position, setPosition] = useState<WatermarkPosition>("bottom-right");
  const [opacity, setOpacity] = useState(0.5);
  const [resultImage, setResultImage] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultImage(null);
    }
  };

  const applyWatermark = () => {
    if (!file || !text.trim()) return;

    run(
      async (setProgress) => {
        setResultImage(null);
        setProgress(30);
        const blob = await addImageWatermark(
          file,
          { text, position, opacity, color: "#ffffff", fontSizeRatio: 0.06 },
          preferredOutputFormat(file),
          0.92
        );
        setProgress(100);
        setResultImage(blob);
      },
      {
        successMessage: "Watermark added successfully!",
        toolName: "image-watermark",
        errorTitle: "Failed to add watermark",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid image file",
      }
    );
  };

  const downloadResult = () => {
    if (!resultImage) return;
    const extension = resultImage.type === "image/png" ? "png" : "jpg";
    downloadBlob(resultImage, `watermarked.${extension}`);
  };

  const clear = () => {
    setFile(null);
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
              <h1>Image Watermark</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !resultImage && (
              <FileUpload
                accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] }}
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
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="watermark-text" className="text-sm font-medium">
                    Watermark text
                  </label>
                  <input
                    id="watermark-text"
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="watermark-position" className="text-sm font-medium">
                    Position
                  </label>
                  <Select value={position} onValueChange={(v) => setPosition(v as WatermarkPosition)}>
                    <SelectTrigger id="watermark-position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="top-left">Top Left</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      <SelectItem value="tiled">Tiled (repeated)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="watermark-opacity" className="text-sm font-medium">
                    Opacity: {Math.round(opacity * 100)}%
                  </label>
                  <input
                    id="watermark-opacity"
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Adding watermark" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={applyWatermark} disabled={processing || !text.trim()}>
                    Add Watermark
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
                <h3 className="text-xl font-semibold">Watermark added successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download Image
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Watermark Another Image
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
