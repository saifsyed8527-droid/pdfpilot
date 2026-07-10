"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { parsePageRanges, expandPageRanges } from "@/lib/pdf-page-ranges";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface ExtractPagesClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function ExtractPagesClient({ faqs, related }: ExtractPagesClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [pagesToExtract, setPagesToExtract] = useState<string>("");
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultPdf(null);
      loadPageCount(newFiles[0]);
    }
  };

  const loadPageCount = async (pdfFile: File) => {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const count = pdf.getPageCount();
      setPageCount(count);
      setPagesToExtract(`1-${count}`);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF", {
        description: "Please try again with a valid PDF file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
    }
  };

  const extractPages = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultPdf(null);
        const { PDFDocument } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const totalPages = pdf.getPageCount();
        const ranges = parsePageRanges(pagesToExtract);
        const pagesToKeep = expandPageRanges(ranges, totalPages);

        if (pagesToKeep.length === 0) {
          throw new Error("No valid pages were selected. Check your page numbers and try again.");
        }

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
          error instanceof Error ? error.message : "Please try again with valid page numbers",
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "extracted-pages.pdf");
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
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {pageCount} pages
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="pages-to-extract" className="text-sm font-medium">
                    Pages to extract (e.g., 1-3,7,10-12)
                  </label>
                  <input
                    id="pages-to-extract"
                    type="text"
                    value={pagesToExtract}
                    onChange={(e) => setPagesToExtract(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="1-3,7,10-12"
                  />
                </div>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Extracting pages" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button
                    size="lg"
                    onClick={extractPages}
                    disabled={processing || !pagesToExtract}
                  >
                    Extract Pages
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setResultPdf(null);
                    }}
                    disabled={processing}
                  >
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
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setResultPdf(null);
                    }}
                  >
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
