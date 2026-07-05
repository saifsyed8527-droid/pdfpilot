"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";

interface JpgToPdfClientProps {
  faqs: FaqInput[];
}

export function JpgToPdfClient({ faqs }: JpgToPdfClientProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [convertedPdf, setConvertedPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setConvertedPdf(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const convertToPDF = () => {
    if (files.length === 0) return;

    run(
      async (setProgress) => {
        setConvertedPdf(null);
        const pdfDoc = await PDFDocument.create();
        const totalFiles = files.length;

        for (let i = 0; i < totalFiles; i++) {
          const file = files[i];
          const arrayBuffer = await file.arrayBuffer();
          let image;

          if (file.type === "image/png") {
            image = await pdfDoc.embedPng(arrayBuffer);
          } else {
            image = await pdfDoc.embedJpg(arrayBuffer);
          }

          const page = pdfDoc.addPage([image.width, image.height]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
          });

          setProgress(((i + 1) / totalFiles) * 100);
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setConvertedPdf(blob);
      },
      {
        successMessage: "Images converted to PDF!",
        errorTitle: "Failed to convert images",
        onError: (error) => {
          console.error("Error converting images:", error);
          return "Please try again with valid image files";
        },
      }
    );
  };

  const downloadConvertedPdf = () => {
    if (!convertedPdf) return;
    downloadBlob(convertedPdf, "images-to-pdf.pdf");
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
            <CardTitle className="text-2xl md:text-3xl">JPG to PDF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {files.length === 0 && !convertedPdf && (
              <FileUpload
                accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] }}
                multiple
                onFilesSelected={handleFilesSelected}
              />
            )}

            {files.length > 0 && !convertedPdf && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="relative group"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full aspect-square object-cover rounded-lg border"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeFile(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2 truncate">
                        {file.name}
                      </p>
                    </div>
                  ))}
                </div>

                <FileUpload
                  accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] }}
                  multiple
                  onFilesSelected={handleFilesSelected}
                />

                {processing && <Progress value={progress} className="h-2" />}

                <div className="flex gap-4 flex-wrap">
                  <Button
                    size="lg"
                    onClick={convertToPDF}
                    disabled={processing || files.length === 0}
                  >
                    Convert to PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFiles([]);
                      setConvertedPdf(null);
                    }}
                    disabled={processing}
                  >
                    Clear All
                  </Button>
                </div>
              </>
            )}

            {convertedPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Images converted to PDF!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadConvertedPdf}>
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFiles([]);
                      setConvertedPdf(null);
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
