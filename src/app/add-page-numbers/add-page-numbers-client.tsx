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
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface AddPageNumbersClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function AddPageNumbersClient({ faqs, related }: AddPageNumbersClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [numberedPdf, setNumberedPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setNumberedPdf(null);
      loadPageCount(newFiles[0]);
    }
  };

  const loadPageCount = async (pdfFile: File) => {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setPageCount(pdf.getPageCount());
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF", {
        description: "Please try again with a valid PDF file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
    }
  };

  const addPageNumbers = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setNumberedPdf(null);
        const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const pages = pdf.getPages();
        const totalPages = pages.length;
        const fontSize = 10;

        pages.forEach((page, index) => {
          const label = `Page ${index + 1} of ${totalPages}`;
          const textWidth = font.widthOfTextAtSize(label, fontSize);
          const { width } = page.getSize();

          page.drawText(label, {
            x: (width - textWidth) / 2,
            y: 20,
            size: fontSize,
            font,
            color: rgb(0.35, 0.35, 0.35),
          });

          setProgress(((index + 1) / totalPages) * 100);
        });

        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setNumberedPdf(blob);
      },
      {
        successMessage: "Page numbers added!",
        toolName: "add-page-numbers",
        errorTitle: "Failed to add page numbers",
        onError: (error) => {
          console.error("Error adding page numbers:", error);
          return "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadNumberedPdf = () => {
    if (!numberedPdf) return;
    downloadBlob(numberedPdf, "numbered.pdf");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>Add Page Numbers</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !numberedPdf && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !numberedPdf && (
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

                <p className="text-sm text-muted-foreground">
                  Page numbers will be added at the bottom center of every page, in the format
                  &quot;Page X of {pageCount}&quot;.
                </p>

                {processing && <Progress value={progress} className="h-2" aria-label="Adding page numbers" />}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={addPageNumbers} disabled={processing}>
                    Add Page Numbers
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setNumberedPdf(null);
                    }}
                    disabled={processing}
                  >
                    Clear
                  </Button>
                </div>
              </>
            )}

            {numberedPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Page numbers added!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadNumberedPdf}>
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setNumberedPdf(null);
                    }}
                  >
                    Number Another PDF
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">Frequently Asked Questions</CardTitle>
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
    </main>
  );
}
