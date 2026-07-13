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
  readImageExif,
  removeImageExif,
  preferredOutputFormat,
  type ImageExifData,
  type OutputImageFormat,
} from "@/lib/engines/image-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface ImageMetadataClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

const EXTENSION_BY_FORMAT: Record<OutputImageFormat, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const FIELD_LABELS: { key: keyof ImageExifData; label: string }[] = [
  { key: "make", label: "Camera Make" },
  { key: "model", label: "Camera Model" },
  { key: "dateTaken", label: "Date Taken" },
  { key: "software", label: "Software" },
  { key: "gpsLatitude", label: "GPS Latitude" },
  { key: "gpsLongitude", label: "GPS Longitude" },
];

export function ImageMetadataClient({ faqs, related }: ImageMetadataClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [exif, setExif] = useState<ImageExifData | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const selected = newFiles[0];
    setFile(selected);
    setResultBlob(null);

    try {
      setExif(await readImageExif(selected));
    } catch (error) {
      console.error("Error reading image metadata:", error);
      toast.error("Failed to read image", {
        description: "Please try again with a valid image file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      setFile(null);
    }
  };

  const removeMetadata = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultBlob(null);
        setProgress(30);
        const blob = await removeImageExif(file, preferredOutputFormat(file));
        setProgress(100);
        setResultBlob(blob);
      },
      {
        successMessage: "Metadata removed successfully!",
        toolName: "image-metadata",
        errorTitle: "Failed to remove metadata",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid image file",
      }
    );
  };

  const downloadResult = () => {
    if (!resultBlob || !file) return;
    downloadBlob(resultBlob, `no-metadata.${EXTENSION_BY_FORMAT[preferredOutputFormat(file)]}`);
  };

  const clear = () => {
    setFile(null);
    setExif(null);
    setResultBlob(null);
  };

  const hasVisibleFields = exif && FIELD_LABELS.some(({ key }) => exif[key] !== undefined);

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
              <h1>Image Metadata</h1>
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

                {hasVisibleFields ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {FIELD_LABELS.filter(({ key }) => exif?.[key] !== undefined).map(({ key, label }) => (
                      <div key={key} className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-medium">
                          {exif?.[key] instanceof Date
                            ? (exif[key] as Date).toLocaleString()
                            : String(exif?.[key])}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No EXIF metadata was found in this image — many screenshots, PNGs, and
                    web-saved images don&apos;t carry any.
                  </p>
                )}

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Removing metadata" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={removeMetadata} disabled={processing}>
                    Remove All Metadata
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
                <h3 className="text-xl font-semibold">Metadata removed successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download Image
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Check Another Image
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
