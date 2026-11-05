"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { CloudImportButtons } from "./tool/CloudImportButtons";

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

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept,
    multiple,
    maxSize,
  });

  return (
    <>
    <div
      {...getRootProps({
        role: "presentation", tabIndex: -1,
        "aria-label": "Upload files. Drag and drop, or activate to select files from your device.",
      })}
      className={`mx-auto flex w-full max-w-lg flex-col items-center justify-center border-2 border-dashed rounded-2xl px-2 py-5 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-transparent hover:border-muted-foreground/25"
      }`}
    >
      <input {...getInputProps()} />
      {supportedFormatsLabel && (
        <p className="text-sm text-muted-foreground mb-6">{supportedFormatsLabel}</p>
      )}
      <CloudImportButtons accept={accept} multiple={multiple} maxSize={maxSize} onFilesSelected={onFilesSelected}>
        <button type="button" onClick={open} className="inline-flex items-center justify-center gap-3 rounded-xl bg-slate-950 px-5 py-4 text-base font-semibold text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
          <Upload className="h-5 w-5 shrink-0" aria-hidden />{isDragActive ? "Drop your file here..." : primaryLabel}
        </button>
      </CloudImportButtons>
      {secondaryLabel && !isDragActive && (
        <p className="mt-4 text-sm text-muted-foreground">{secondaryLabel}</p>
      )}
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-5 w-full max-w-sm">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-500 shrink-0" aria-hidden="true" />
          Local files are processed in your browser
        </span>
        <span aria-hidden="true" className="text-muted-foreground/40">•</span>
        <span>Max size: {maxSize / 1024 / 1024}MB</span>
      </p>
    </div>
    </>
  );
}
