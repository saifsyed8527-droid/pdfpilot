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

type Scope = "all" | "single";
type CropMode = "preset" | "custom";
type Preset = "10" | "20" | "30";

interface CropPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function CropPdfClient({ faqs, related }: CropPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [scope, setScope] = useState<Scope>("all");
  const [pageNumber, setPageNumber] = useState<string>("1");
  const [cropMode, setCropMode] = useState<CropMode>("preset");
  const [preset, setPreset] = useState<Preset>("10");
  const [customTop, setCustomTop] = useState("0");
  const [customRight, setCustomRight] = useState("0");
  const [customBottom, setCustomBottom] = useState("0");
  const [customLeft, setCustomLeft] = useState("0");
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
      setPageCount(pdf.getPageCount());
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF", {
        description: "Please try again with a valid PDF file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
    }
  };

  const cropPdf = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultPdf(null);
        const { PDFDocument } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = pdf.getPages();
        const totalPages = pages.length;

        let targetIndices: number[];
        if (scope === "single") {
          const num = Number(pageNumber);
          if (!Number.isInteger(num) || num < 1 || num > totalPages) {
            throw new Error(`Enter a page number between 1 and ${totalPages}.`);
          }
          targetIndices = [num - 1];
        } else {
          targetIndices = pages.map((_, i) => i);
        }

        targetIndices.forEach((pageIndex, step) => {
          const page = pages[pageIndex];
          const box = page.getCropBox();

          let top: number, right: number, bottom: number, left: number;
          if (cropMode === "preset") {
            const fraction = Number(preset) / 100;
            top = box.height * fraction;
            right = box.width * fraction;
            bottom = box.height * fraction;
            left = box.width * fraction;
          } else {
            top = Number(customTop) || 0;
            right = Number(customRight) || 0;
            bottom = Number(customBottom) || 0;
            left = Number(customLeft) || 0;
          }

          const newWidth = box.width - left - right;
          const newHeight = box.height - top - bottom;

          if (newWidth <= 0 || newHeight <= 0) {
            throw new Error("These crop values would remove the entire page. Use smaller values.");
          }

          page.setCropBox(box.x + left, box.y + bottom, newWidth, newHeight);
          setProgress(((step + 1) / targetIndices.length) * 100);
        });

        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setResultPdf(blob);
      },
      {
        successMessage: "PDF cropped successfully!",
        toolName: "crop-pdf",
        errorTitle: "Failed to crop PDF",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid PDF file",
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "cropped.pdf");
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
              <h1>Crop PDF</h1>
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
                  <label className="text-sm font-medium">Apply to</label>
                  <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All pages</SelectItem>
                      <SelectItem value="single">A single page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scope === "single" && (
                  <div className="space-y-2">
                    <label htmlFor="crop-page-number" className="text-sm font-medium">
                      Page number (1–{pageCount})
                    </label>
                    <input
                      id="crop-page-number"
                      type="number"
                      min={1}
                      max={pageCount}
                      value={pageNumber}
                      onChange={(e) => setPageNumber(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Crop mode</label>
                  <Select value={cropMode} onValueChange={(v) => setCropMode(v as CropMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preset">Preset margin</SelectItem>
                      <SelectItem value="custom">Custom margins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {cropMode === "preset" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Trim margin</label>
                    <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10% from every edge</SelectItem>
                        <SelectItem value="20">20% from every edge</SelectItem>
                        <SelectItem value="30">30% from every edge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="crop-top" className="text-sm font-medium">Top (pt)</label>
                      <input
                        id="crop-top"
                        type="number"
                        min={0}
                        value={customTop}
                        onChange={(e) => setCustomTop(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="crop-right" className="text-sm font-medium">Right (pt)</label>
                      <input
                        id="crop-right"
                        type="number"
                        min={0}
                        value={customRight}
                        onChange={(e) => setCustomRight(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="crop-bottom" className="text-sm font-medium">Bottom (pt)</label>
                      <input
                        id="crop-bottom"
                        type="number"
                        min={0}
                        value={customBottom}
                        onChange={(e) => setCustomBottom(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="crop-left" className="text-sm font-medium">Left (pt)</label>
                      <input
                        id="crop-left"
                        type="number"
                        min={0}
                        value={customLeft}
                        onChange={(e) => setCustomLeft(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      />
                    </div>
                  </div>
                )}

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Cropping PDF" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={cropPdf} disabled={processing}>
                    Crop PDF
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
                <h3 className="text-xl font-semibold">PDF cropped successfully!</h3>
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
                    Crop Another PDF
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
