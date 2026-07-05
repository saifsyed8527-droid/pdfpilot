"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";

interface SplitPdfClientProps {
  faqs: FaqInput[];
}

export function SplitPdfClient({ faqs }: SplitPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [selectedRanges, setSelectedRanges] = useState<string>("1");
  const [splitPdfs, setSplitPdfs] = useState<Blob[]>([]);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setSelectedRanges("1");
      setSplitPdfs([]);
      loadPageCount(newFiles[0]);
    }
  };

  const loadPageCount = async (pdfFile: File) => {
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setPageCount(pdf.getPageCount());
      setSelectedRanges(`1-${pdf.getPageCount()}`);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF", {
        description: "Please try again with a valid PDF file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
    }
  };

  const parseRanges = (input: string): number[][] => {
    const ranges: number[][] = [];
    const parts = input.split(",").map((s) => s.trim());

    parts.forEach((part) => {
      if (part.includes("-")) {
        const [start, end] = part.split("-").map(Number);
        ranges.push([start, end]);
      } else {
        const page = Number(part);
        ranges.push([page, page]);
      }
    });

    return ranges;
  };

  const splitPDF = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setSplitPdfs([]);
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const totalPages = pdf.getPageCount();
        const ranges = parseRanges(selectedRanges);
        const splitBlobs: Blob[] = [];

        for (let i = 0; i < ranges.length; i++) {
          const [start, end] = ranges[i];
          const newPdf = await PDFDocument.create();
          const pagesToCopy = [];

          for (let page = start; page <= end; page++) {
            if (page > 0 && page <= totalPages) {
              pagesToCopy.push(page - 1);
            }
          }

          const copiedPages = await newPdf.copyPages(pdf, pagesToCopy);
          copiedPages.forEach((page) => newPdf.addPage(page));

          const pdfBytes = await newPdf.save();
          splitBlobs.push(new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" }));
          setProgress(((i + 1) / ranges.length) * 100);
        }

        setSplitPdfs(splitBlobs);
      },
      {
        successMessage: "PDF split successfully!",
        errorTitle: "Failed to split PDF",
        onError: (error) => {
          console.error("Error splitting PDF:", error);
          return "Please try again with valid page ranges";
        },
      }
    );
  };

  const downloadAll = () => {
    splitPdfs.forEach((blob, index) => {
      downloadBlob(blob, `split-${index + 1}.pdf`);
    });
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
            <CardTitle className="text-2xl md:text-3xl">Split PDF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && splitPdfs.length === 0 && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && splitPdfs.length === 0 && (
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
                  <label className="text-sm font-medium">
                    Page Ranges (e.g., 1-3,5,7-9)
                  </label>
                  <input
                    type="text"
                    value={selectedRanges}
                    onChange={(e) => setSelectedRanges(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="1-3,5,7-9"
                  />
                </div>

                {processing && <Progress value={progress} className="h-2" />}

                <div className="flex gap-4 flex-wrap">
                  <Button
                    size="lg"
                    onClick={splitPDF}
                    disabled={processing || !selectedRanges}
                  >
                    Split PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setSplitPdfs([]);
                    }}
                    disabled={processing}
                  >
                    Clear
                  </Button>
                </div>
              </>
            )}

            {splitPdfs.length > 0 && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">PDF split successfully!</h3>
                <p className="text-muted-foreground">{splitPdfs.length} files created</p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadAll}>
                    Download All
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setSplitPdfs([]);
                    }}
                  >
                    Split Another PDF
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
      </div>
    </main>
  );
}
