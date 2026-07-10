"use client";

import { useState } from "react";
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
import { Download, FileText, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

type RotationAngle = "90" | "180" | "270";

const ROTATION_LABELS: Record<RotationAngle, string> = {
  "90": "90° Clockwise",
  "180": "180°",
  "270": "90° Counterclockwise",
};

interface RotatePdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function RotatePdfClient({ faqs, related }: RotatePdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [rotation, setRotation] = useState<RotationAngle>("90");
  const [rotatedPdf, setRotatedPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setRotatedPdf(null);
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

  const rotatePDF = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setRotatedPdf(null);
        const { PDFDocument, degrees } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = pdf.getPages();
        const angle = Number(rotation);

        pages.forEach((page, index) => {
          const currentAngle = page.getRotation().angle;
          page.setRotation(degrees((currentAngle + angle) % 360));
          setProgress(((index + 1) / pages.length) * 100);
        });

        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setRotatedPdf(blob);
      },
      {
        successMessage: "PDF rotated successfully!",
        toolName: "rotate-pdf",
        errorTitle: "Failed to rotate PDF",
        onError: (error) => {
          console.error("Error rotating PDF:", error);
          return "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadRotatedPdf = () => {
    if (!rotatedPdf) return;
    downloadBlob(rotatedPdf, "rotated.pdf");
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
              <h1>Rotate PDF</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !rotatedPdf && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !rotatedPdf && (
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
                  <label htmlFor="rotation-angle" className="text-sm font-medium">
                    Rotation
                  </label>
                  <Select value={rotation} onValueChange={(v) => setRotation(v as RotationAngle)}>
                    <SelectTrigger id="rotation-angle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROTATION_LABELS) as RotationAngle[]).map((angle) => (
                        <SelectItem key={angle} value={angle}>
                          {ROTATION_LABELS[angle]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {processing && <Progress value={progress} className="h-2" aria-label="Rotating PDF" />}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={rotatePDF} disabled={processing}>
                    Rotate PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setRotatedPdf(null);
                    }}
                    disabled={processing}
                  >
                    Clear
                  </Button>
                </div>
              </>
            )}

            {rotatedPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">PDF rotated successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadRotatedPdf}>
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setRotatedPdf(null);
                    }}
                  >
                    Rotate Another PDF
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
