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
import {
  readImageExif,
  removeImageExif,
  preferredOutputFormat,
  type ImageExifData,
  type OutputImageFormat,
} from "@/lib/engines/image-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

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
    <FileToolLayout toolSlug="image-metadata" files={[file]}
      accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] }} multiple={false} onFilesSelected={handleFilesSelected}
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

    </FileToolLayout>
  );
}
