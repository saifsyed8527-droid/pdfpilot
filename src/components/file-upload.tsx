"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  maxSize?: number;
  supportedFormatsLabel?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export function FileUpload({
  onFilesSelected,
  accept,
  multiple = true,
  maxSize = 100 * 1024 * 1024,
  supportedFormatsLabel,
  primaryLabel = "Select or drop your file(s)",
  secondaryLabel,
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        const tooManyFiles = fileRejections.some((rejection) =>
          rejection.errors.some((error) => error.code === "too-many-files")
        );
        if (tooManyFiles) {
          toast.error("Only one file at a time", {
            description: "This tool accepts a single file. Select just one and try again.",
            icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          });
        }

        fileRejections.forEach((rejection) => {
          rejection.errors.forEach((error) => {
            if (error.code === "file-too-large") {
              toast.error("File is too large", {
                description: `${rejection.file.name} exceeds the ${maxSize / 1024 / 1024}MB limit`,
                icon: <AlertCircle className="h-5 w-5 text-red-500" />,
              });
            } else if (error.code === "file-invalid-type") {
              toast.error("Invalid file type", {
                description: `${rejection.file.name} is not an accepted file type`,
                icon: <AlertCircle className="h-5 w-5 text-red-500" />,
              });
            }
          });
        });
      }

      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles);
      }
    },
    [onFilesSelected, maxSize]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple,
    maxSize,
  });

  return (
    <div
      {...getRootProps({
        role: "button",
        "aria-label": "Upload files. Drag and drop, or activate to select files from your device.",
      })}
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-white dark:bg-zinc-900/50 ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/40"
      }`}
    >
      <input {...getInputProps()} />
      {supportedFormatsLabel && (
        <p className="text-sm text-muted-foreground mb-6">{supportedFormatsLabel}</p>
      )}
      <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-primary/10 mb-5">
        <Upload className="h-12 w-12 text-primary" />
      </div>
      <p className="text-xl font-semibold mb-2">
        {isDragActive ? "Drop your file here..." : primaryLabel}
      </p>
      {secondaryLabel && !isDragActive && (
        <p className="text-sm text-muted-foreground">{secondaryLabel}</p>
      )}
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-8 pt-4 border-t border-dashed w-full max-w-sm">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-500 shrink-0" aria-hidden="true" />
          Files never leave your device
        </span>
        <span aria-hidden="true" className="text-muted-foreground/40">•</span>
        <span>Max size: {maxSize / 1024 / 1024}MB</span>
      </p>
    </div>
  );
}
