"use client";

import { useState, useCallback } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { loadPdfjs } from "@/lib/pdfjs";
import { useProcessingTask } from "@/lib/use-processing-task";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface PdfToJpgClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function PdfToJpgClient({ faqs, related }: PdfToJpgClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [convertedImages, setConvertedImages] = useState<{
    pageNum: number;
    dataUrl: string;
    blob: Blob;
  }[]>([]);
  const { processing, progress, setProgress, run } = useProcessingTask();

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setConvertedImages([]);
      setProgress(0);
    }
  }, [setProgress]);

  const convertPDFToJPG = useCallback(() => {
    if (!file) return;

    run(
      async (setProgress) => {
        setConvertedImages([]);

        const pdfjsLib = await loadPdfjs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const numPages = pdf.numPages;
        const images: {
          pageNum: number;
          dataUrl: string;
          blob: Blob;
        }[] = [];

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 }); // 2x scale for quality

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) {
            console.warn("Canvas 2D context not available, skipping page");
            continue;
          }

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvas: canvas,
            viewport: viewport,
          }).promise;

          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
            }, "image/jpeg", 0.9);
          });

          images.push({ pageNum: i, dataUrl, blob });
          setProgress((i / numPages) * 100);
        }

        setConvertedImages(images);
      },
      {
        successMessage: "PDF converted successfully!",
        toolName: "pdf-to-jpg",
        errorTitle: "Failed to convert PDF",
        onError: (error) => {
          console.error("Error converting PDF:", error);
          console.error("Error stack trace:", (error as Error).stack);
          return (error as Error).message;
        },
      }
    );
  }, [file, run]);

  const downloadImage = useCallback((image: typeof convertedImages[0]) => {
    downloadBlob(image.blob, `page-${image.pageNum}.jpg`);
  }, []);

  const downloadAll = useCallback(() => {
    convertedImages.forEach((image) => downloadImage(image));
  }, [convertedImages, downloadImage]);

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>PDF to JPG</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && convertedImages.length === 0 && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && convertedImages.length === 0 && (
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
                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Converting PDF to JPG" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button
                    size="lg"
                    onClick={convertPDFToJPG}
                    disabled={processing}
                  >
                    Convert to JPG
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setConvertedImages([]);
                    }}
                    disabled={processing}
                  >
                    Clear
                  </Button>
                </div>
              </>
            )}

            {convertedImages.length > 0 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                    <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold">PDF converted successfully!</h3>
                  <p className="text-muted-foreground mt-2">
                    {convertedImages.length} page{convertedImages.length > 1 ? "s" : ""} converted
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {convertedImages.map((image) => (
                    <Card key={image.pageNum} className="overflow-hidden">
                      <img
                        src={image.dataUrl}
                        alt={`Page ${image.pageNum}`}
                        className="w-full"
                      />
                      <div className="p-4 border-t flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Page {image.pageNum}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadImage(image)}
                          aria-label={`Download page ${image.pageNum}`}
                        >
                          Download
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="flex gap-4 justify-center flex-wrap">
                  <Button
                    size="lg"
                    onClick={downloadAll}
                  >
                    Download All
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setConvertedImages([]);
                    }}
                  >
                    Convert Another PDF
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
