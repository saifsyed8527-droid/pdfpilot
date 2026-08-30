"use client";

import { useRef, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Presentation, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize } from "@/lib/utils";
import { useProcessingTask } from "@/lib/use-processing-task";
import { convertPptxToPdf } from "@/lib/engines/pptx-engine";
import { ToolHeader } from "@/components/tool/ToolHeader";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { TrustSection } from "@/components/tool/TrustSection";
import { ToolFaqAccordion } from "@/components/tool/ToolFaqAccordion";
import { getTool } from "@/lib/tools";
import { getCrossSellTools } from "@/lib/cross-sell";

const tool = getTool("/powerpoint-to-pdf")!;

interface PowerpointToPdfClientProps {
  faqs: FaqInput[];
}

export function PowerpointToPdfClient({ faqs }: PowerpointToPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run, cancel } = useProcessingTask();
  const autoDownloadRef = useRef<boolean>(false);

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultPdf(null);
    }
  };

  const convertToPdf = () => {
    if (!file) return;

    run(
      async (setProgress, isCancelled) => {
        setResultPdf(null);
        autoDownloadRef.current = false;
        const blob = await convertPptxToPdf(file, setProgress, isCancelled);
        if (isCancelled()) return;
        setResultPdf(blob);
      },
      {
        successMessage: "Converted to PDF successfully!",
        toolName: "powerpoint-to-pdf",
        errorTitle: "Failed to convert to PDF",
        onError: (error) => {
          console.error("Error converting PowerPoint to PDF:", error);
          return error instanceof Error ? error.message : "Please try again with a valid PowerPoint file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "converted.pdf");
  };

  const clear = () => {
    setFile(null);
    setResultPdf(null);
  };

  return (
    <div className="flex-1 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <ToolHeader tool={tool} />
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground -mt-2">
              Each slide becomes one PDF page with its real layout — text position, fonts,
              colors, shape fills, and images all carry over. Tables, charts, and rotated
              or grouped-and-rotated shapes aren&apos;t reproduced yet.
            </p>

            {!file && !resultPdf && (
              <FileUpload
                accept={{
                  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
                }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !resultPdf && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <Presentation className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" title={file.name}>{file.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                </div>

                {processing ? (
                  <ProcessingState progress={progress} label="Converting to PDF..." onCancel={cancel} />
                ) : (
                  <div className="flex gap-4 flex-wrap">
                    <Button size="lg" onClick={convertToPdf}>
                      Convert to PDF
                    </Button>
                    <Button variant="outline" onClick={clear}>
                      Clear
                    </Button>
                  </div>
                )}
              </>
            )}

            {resultPdf && (
              <ResultState
                resultFilename="converted.pdf"
                fileSize={formatFileSize(resultPdf.size)}
                onDownload={downloadResult}
                downloadLabel="Download PDF"
                onStartOver={clear}
                autoDownloadedRef={autoDownloadRef}
              />
            )}
          </CardContent>
        </Card>

        {resultPdf && (
          <>
            <RelatedTools tools={getCrossSellTools("powerpoint-to-pdf")} />
            <TrustSection />
          </>
        )}

        <ToolFaqAccordion faqs={faqs} />
      </div>
    </div>
  );
}
