"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { renderPdfPages } from "@/lib/engines/pdf-render-engine";
import { recognizeText } from "@/lib/engines/ocr-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface OcrPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function OcrPdfClient({ faqs, related }: OcrPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultText, setResultText] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultText(null);
    }
  };

  const extractText = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultText(null);
        const pages = await renderPdfPages(file, 2);

        const pageTexts: string[] = [];
        for (let i = 0; i < pages.length; i++) {
          const { pageNumber, canvas } = pages[i];
          const { text } = await recognizeText(canvas, (pageProgress) => {
            const overall = ((i + pageProgress / 100) / pages.length) * 100;
            setProgress(overall);
          });
          pageTexts.push(`--- Page ${pageNumber} ---\n${text.trim()}`);
        }

        const combined = pageTexts.join("\n\n");
        if (!combined.replace(/--- Page \d+ ---/g, "").trim()) {
          throw new Error(
            "No text could be recognized in this PDF. It may be blank, or the scan quality may be too low."
          );
        }

        setProgress(100);
        setResultText(new Blob([combined], { type: "text/plain" }));
      },
      {
        successMessage: "Text extracted successfully!",
        toolName: "ocr-pdf",
        errorTitle: "Failed to extract text",
        onError: (error) => {
          console.error("Error running OCR:", error);
          return error instanceof Error ? error.message : "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!resultText) return;
    downloadBlob(resultText, "extracted-text.txt");
  };

  const clear = () => {
    setFile(null);
    setResultText(null);
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
              <h1>OCR PDF</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !resultText && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !resultText && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  OCR runs entirely in your browser and can take several seconds per page —
                  larger PDFs will take longer.
                </p>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Extracting text" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={extractText} disabled={processing}>
                    Extract Text
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {resultText && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Text extracted successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download Text
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Extract From Another PDF
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
