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
import { convertImageFormat, type OutputImageFormat } from "@/lib/engines/image-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

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
        setProgress(30);
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
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>Convert Image</h1>
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
