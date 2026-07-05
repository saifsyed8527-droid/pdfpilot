"use client";

import { useState, useCallback } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";

interface PdfToJpgClientProps {
  faqs: FaqInput[];
}

export function PdfToJpgClient({ faqs }: PdfToJpgClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [convertedImages, setConvertedImages] = useState<{
    pageNum: number;
    dataUrl: string;
    blob: Blob;
  }[]>([]);

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setConvertedImages([]);
      setProgress(0);
    }
  }, []);

  const convertPDFToJPG = useCallback(async () => {
    if (!file) return;

    setProcessing(true);
    setProgress(0);
    setConvertedImages([]);

    try {
      console.log("[1/5] Starting PDF to JPG conversion");

      // Dynamically import pdfjs-dist only on client
      console.log("[2/5] Dynamically importing pdfjs-dist");
      const pdfjsLib = await import("pdfjs-dist");
      console.log("[3/5] pdfjs-dist imported successfully, version:", pdfjsLib.version);

      // Set worker source using static public file
      console.log("[4/5] Setting up local worker source");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      console.log("[5/5] Worker source set to:", pdfjsLib.GlobalWorkerOptions.workerSrc);

      console.log("Reading file as ArrayBuffer");
      const arrayBuffer = await file.arrayBuffer();
      console.log("File read successfully, size:", arrayBuffer.byteLength, "bytes");

      console.log("Loading PDF with getDocument");
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log("PDF loaded successfully, total pages:", pdf.numPages);

      const numPages = pdf.numPages;
      const images: {
        pageNum: number;
        dataUrl: string;
        blob: Blob;
      }[] = [];

      for (let i = 1; i <= numPages; i++) {
        console.log(`Processing page ${i} of ${numPages}`);
        const page = await pdf.getPage(i);
        console.log(`Got page ${i}`);

        const viewport = page.getViewport({ scale: 2 }); // 2x scale for quality
        console.log(`Viewport created for page ${i}:`, viewport);

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          console.warn("Canvas 2D context not available, skipping page");
          continue;
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        console.log(`Canvas size set to ${viewport.width}x${viewport.height}`);

        console.log(`Rendering page ${i} to canvas`);
        await page.render({
          canvas: canvas,
          viewport: viewport,
        }).promise;
        console.log(`Page ${i} rendered successfully`);

        console.log(`Converting page ${i} to JPG`);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
          }, "image/jpeg", 0.9);
        });
        console.log(`Page ${i} converted to JPG`);

        images.push({ pageNum: i, dataUrl, blob });
        setProgress((i / numPages) * 100);
      }

      console.log("All pages processed successfully");
      setConvertedImages(images);
      toast.success("PDF converted successfully!", {
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />
      });
    } catch (error) {
      console.error("Error converting PDF:", error);
      console.error("Error stack trace:", (error as Error).stack);
      toast.error("Failed to convert PDF", {
        description: (error as Error).message,
        icon: <AlertCircle className="h-5 w-5 text-red-500" />
      });
    } finally {
      setProcessing(false);
    }
  }, [file]);

  const downloadImage = useCallback((image: typeof convertedImages[0]) => {
    const url = URL.createObjectURL(image.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `page-${image.pageNum}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadAll = useCallback(() => {
    convertedImages.forEach((image) => downloadImage(image));
  }, [convertedImages, downloadImage]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl">PDF to JPG</CardTitle>
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
                {processing && <Progress value={progress} className="h-2" />}

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
