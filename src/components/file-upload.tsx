"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  maxSize?: number;
}

export function FileUpload({
  onFilesSelected,
  accept,
  multiple = true,
  maxSize = 100 * 1024 * 1024,
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
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
      className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50"
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-lg font-medium mb-2">
        {isDragActive ? "Drop the files here..." : "Drag and drop files here"}
      </p>
      <p className="text-sm text-muted-foreground">
        or click to select files
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        Maximum file size: {maxSize / 1024 / 1024}MB
      </p>
    </div>
  );
}