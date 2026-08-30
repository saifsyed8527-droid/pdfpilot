"use client";

import React, { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { DownloadButton } from "./DownloadButton";
import { StartOverButton } from "./StartOverButton";

interface ResultStateProps {
  resultFilename: string;
  fileSize?: string;
  onDownload: () => void;
  onStartOver: () => void;
  autoDownloadedRef?: React.MutableRefObject<boolean>;
  /** e.g. "Download PDF", "Download DOCX" — defaults to plain "Download". */
  downloadLabel?: string;
}

export function ResultState({
  resultFilename,
  fileSize,
  onDownload,
  onStartOver,
  autoDownloadedRef,
  downloadLabel,
}: ResultStateProps) {
  useEffect(() => {
    if (autoDownloadedRef) {
      if (!autoDownloadedRef.current) {
        autoDownloadedRef.current = true;
        onDownload();
      }
    } else {
      onDownload();
    }
  }, [onDownload, autoDownloadedRef]);

  return (
    <div className="flex flex-col items-center text-center py-8 space-y-6">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-green-500/10 scale-150" />
        <CheckCircle2
          className="h-16 w-16 text-green-500 relative"
          aria-hidden="true"
        />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">
          Your file is ready
        </h2>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{resultFilename}</span>
          {fileSize && (
            <span className="ml-2">({fileSize})</span>
          )}
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 w-full sm:w-auto pt-2">
        <DownloadButton onClick={onDownload} size="lg">{downloadLabel ?? "Download"}</DownloadButton>
        <StartOverButton onClick={onStartOver} size="sm" />
      </div>
    </div>
  );
}
