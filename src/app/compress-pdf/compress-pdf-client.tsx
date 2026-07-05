"use client";

import { useState, useCallback } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { loadPdfjs } from "@/lib/pdfjs";
import { useProcessingTask } from "@/lib/use-processing-task";

type QualityLevel = "low" | "medium" | "high";

const qualitySettings = {
  low: { scale: 0.6, jpegQuality: 0.5, label: "Maximum Compression" },
  medium: { scale: 0.8, jpegQuality: 0.7, label: "Medium" },
  high: { scale: 1.0, jpegQuality: 0.92, label: "High Quality" },
};

interface CompressPdfClientProps {
  faqs: FaqInput[];
}

export function CompressPdfClient({ faqs }: CompressPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<QualityLevel>("medium");
  const [compressedPdf, setCompressedPdf] = useState<Blob | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setOriginalSize(newFiles[0].size);
      setCompressedPdf(null);
    }
  }, []);

  const compressPDF = useCallback(() => {
    if (!file) return;

    run(
      async (setProgress) => {
        setCompressedPdf(null);
        const arrayBuffer = await file.arrayBuffer();
        const pdfjsLib = await loadPdfjs();
        setProgress(10);

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        setProgress(20);

        const newPdfDoc = await PDFDocument.create();

        for (let i = 1; i <= numPages; i++) {
          setProgress(20 + Math.floor(((i - 1) / numPages) * 60));
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: qualitySettings[quality].scale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          await page.render({ canvas: canvas, viewport: viewport }).promise;

          const jpegBlob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Failed to convert canvas to blob"));
            }, "image/jpeg", qualitySettings[quality].jpegQuality)
          );

          const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
          const jpegImage = await newPdfDoc.embedJpg(jpegBytes);

          const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
          newPage.drawImage(jpegImage, {
            x: 0,
            y: 0,
            width: viewport.width,
            height: viewport.height,
          });
        }

        setProgress(85);
        const pdfBytes = await newPdfDoc.save({
          useObjectStreams: true,
          addDefaultPage: false,
        });
        setProgress(95);

        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setCompressedPdf(blob);
        setCompressedSize(blob.size);
        setProgress(100);
      },
      {
        successMessage: "PDF compressed successfully!",
        errorTitle: "Failed to compress PDF",
        onError: (error) => {
          console.error("Error compressing PDF:", error);
          return "Please try again with a valid PDF file";
        },
      }
    );
  }, [file, quality, run]);

  const downloadCompressedPdf = () => {
    if (!compressedPdf) return;
    downloadBlob(compressedPdf, "compressed.pdf");
  };

  const calculateSavings = () => {
    if (!originalSize || !compressedSize) return 0;
    return Math.round(((originalSize - compressedSize) / originalSize) * 100);
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
            <CardTitle className="text-2xl md:text-3xl">Compress PDF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !compressedPdf && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !compressedPdf && (
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

                <div className="space-y-2">
                  <label htmlFor="compression-quality" className="text-sm font-medium">Compression Quality</label>
                  <Select value={quality} onValueChange={(value) => setQuality(value as QualityLevel)}>
                    <SelectTrigger id="compression-quality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Maximum Compression</SelectItem>
                      <SelectItem value="medium">Medium (Recommended)</SelectItem>
                      <SelectItem value="high">High Quality</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {processing && <Progress value={progress} className="h-2" />}

                <div className="flex gap-4 flex-wrap">
                  <Button
                    size="lg"
                    onClick={compressPDF}
                    disabled={processing}
                  >
                    Compress PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setCompressedPdf(null);
                    }}
                    disabled={processing}
                  >
                    Clear
                  </Button>
                </div>
              </>
            )}

            {compressedPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">PDF compressed successfully!</h3>
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Original Size</p>
                    <p className="text-xl font-bold">
                      {(originalSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Compressed Size</p>
                    <p className="text-xl font-bold">
                      {(compressedSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {calculateSavings() > 0 && (
                  <p className="text-green-600 dark:text-green-400 font-medium">
                    You saved {calculateSavings()}%!
                  </p>
                )}
                {calculateSavings() <= 0 && (
                  <p className="text-yellow-600 dark:text-yellow-400 font-medium">
                    PDF couldn&apos;t be compressed further
                  </p>
                )}
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadCompressedPdf}>
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setCompressedPdf(null);
                    }}
                  >
                    Compress Another PDF
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
