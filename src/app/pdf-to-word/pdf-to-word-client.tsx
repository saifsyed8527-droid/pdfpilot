"use client";

import { useRef, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FileText } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { formatFileSize } from "@/lib/utils";
import { useProcessingTask } from "@/lib/use-processing-task";
import { extractPdfText, hasNoExtractableText } from "@/lib/pdf-text-extraction";
import { ToolHeader } from "@/components/tool/ToolHeader";
import { ProcessingState } from "@/components/tool/ProcessingState";
import { ResultState } from "@/components/tool/ResultState";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { TrustSection } from "@/components/tool/TrustSection";
import { ToolFaqAccordion } from "@/components/tool/ToolFaqAccordion";
import { getTool } from "@/lib/tools";
import { getCrossSellTools } from "@/lib/cross-sell";

const tool = getTool("/pdf-to-word")!;

interface PdfToWordClientProps {
  faqs: FaqInput[];
}

export function PdfToWordClient({ faqs }: PdfToWordClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultDocx, setResultDocx] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();
  const autoDownloadRef = useRef<boolean>(false);

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultDocx(null);
    }
  };

  const convertToWord = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultDocx(null);
        autoDownloadRef.current = false;

        const pages = await extractPdfText(file);
        setProgress(50);

        if (hasNoExtractableText(pages)) {
          throw new Error(
            "No text could be extracted from this PDF. It may be a scanned document with no selectable text."
          );
        }

        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
        const HEADING_LEVEL = {
          heading1: HeadingLevel.HEADING_1,
          heading2: HeadingLevel.HEADING_2,
          body: undefined,
        } as const;
        const paragraphs = pages.flatMap((page) =>
          page.paragraphs.map(
            (text, i) =>
              new Paragraph({
                children: [new TextRun(text)],
                heading: HEADING_LEVEL[page.paragraphStyles[i]],
                spacing: { after: 200 },
              })
          )
        );

        const doc = new Document({
          sections: [{ children: paragraphs }],
        });

        const blob = await Packer.toBlob(doc);
        setProgress(100);
        setResultDocx(blob);
      },
      {
        successMessage: "Converted to Word successfully!",
        toolName: "pdf-to-word",
        errorTitle: "Failed to convert to Word",
        onError: (error) => {
          console.error("Error converting PDF to Word:", error);
          return error instanceof Error ? error.message : "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!resultDocx) return;
    downloadBlob(resultDocx, "converted.docx");
  };

  const clear = () => {
    setFile(null);
    setResultDocx(null);
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
              Extracts your PDF&apos;s text into an editable Word document — exact layout,
              fonts, images, and tables aren&apos;t preserved.
            </p>

            {!file && !resultDocx && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !resultDocx && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" title={file.name}>{file.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                </div>

                {processing ? (
                  <ProcessingState progress={progress} label="Converting to Word..." />
                ) : (
                  <div className="flex gap-4 flex-wrap">
                    <Button size="lg" onClick={convertToWord} disabled={processing}>
                      Convert to Word
                    </Button>
                    <Button variant="outline" onClick={clear} disabled={processing}>
                      Clear
                    </Button>
                  </div>
                )}
              </>
            )}

            {resultDocx && (
              <ResultState
                resultFilename="converted.docx"
                fileSize={formatFileSize(resultDocx.size)}
                onDownload={downloadResult}
                downloadLabel="Download DOCX"
                onStartOver={clear}
                autoDownloadedRef={autoDownloadRef}
              />
            )}
          </CardContent>
        </Card>

        {resultDocx && (
          <>
            <RelatedTools tools={getCrossSellTools("pdf-to-word")} />
            <TrustSection />
          </>
        )}

        <ToolFaqAccordion faqs={faqs} />
      </div>
    </div>
  );
}
