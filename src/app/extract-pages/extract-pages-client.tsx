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
import { PageThumbnailGrid } from "@/components/pdf/PageThumbnailGrid";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface ExtractPagesClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function ExtractPagesClient({ faqs, related }: ExtractPagesClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [selectedToKeep, setSelectedToKeep] = useState<Set<number>>(new Set());
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setSelectedToKeep(new Set());
      setResultPdf(null);
    }
  };

  const togglePage = (pageIndex: number) => {
    setSelectedToKeep((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        next.add(pageIndex);
      }
      return next;
    });
  };

  const extractPages = () => {
    if (!file || selectedToKeep.size === 0) return;

    run(
      async (setProgress) => {
        setResultPdf(null);
        const { PDFDocument } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pagesToKeep = [...selectedToKeep].sort((a, b) => a - b);

        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdf, pagesToKeep);
        copiedPages.forEach((page) => newPdf.addPage(page));
        setProgress(100);

        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setResultPdf(blob);
      },
      {
        successMessage: "Pages extracted successfully!",
        toolName: "extract-pages",
        errorTitle: "Failed to extract pages",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid PDF file",
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "extracted-pages.pdf");
  };

  const clear = () => {
    setFile(null);
    setSelectedToKeep(new Set());
    setResultPdf(null);
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
              <h1>Extract Pages</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !resultPdf && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !resultPdf && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB{pageCount > 0 ? ` • ${pageCount} pages` : ""}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Click the pages you want to keep. Everything else is left out.
                </p>

                <PageThumbnailGrid
                  file={file}
                  selected={selectedToKeep}
                  onToggle={togglePage}
                  onPagesLoaded={setPageCount}
                  onError={(error) => {
                    console.error("Error rendering PDF pages:", error);
                  }}
                />

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedToKeep(new Set(Array.from({ length: pageCount }, (_, i) => i)))}
                      disabled={processing}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedToKeep(new Set())}
                      disabled={processing || selectedToKeep.size === 0}
                    >
                      Clear Selection
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {selectedToKeep.size === 0
                      ? "Select at least one page to extract"
                      : `${selectedToKeep.size} of ${pageCount} page${pageCount === 1 ? "" : "s"} will be kept`}
                  </p>
                </div>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Extracting pages" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={extractPages} disabled={processing || selectedToKeep.size === 0}>
                    Extract Pages
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {resultPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Pages extracted successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
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
