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
import { extractPdfText, hasNoExtractableText } from "@/lib/pdf-text-extraction";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface PdfToPowerpointClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function PdfToPowerpointClient({ faqs, related }: PdfToPowerpointClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultPptx, setResultPptx] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultPptx(null);
    }
  };

  const convertToPowerpoint = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultPptx(null);

        const pages = await extractPdfText(file);
        setProgress(40);

        if (hasNoExtractableText(pages)) {
          throw new Error(
            "No text could be extracted from this PDF. It may be a scanned document with no selectable text."
          );
        }

        const PptxGenJS = (await import("pptxgenjs")).default;
        const pptx = new PptxGenJS();

        pages.forEach((page, index) => {
          const slide = pptx.addSlide();
          const text = page.paragraphs.join("\n\n") || `Page ${page.pageNumber}`;
          slide.addText(text, {
            x: "5%",
            y: "5%",
            w: "90%",
            h: "90%",
            fontSize: 14,
            fontFace: "Arial",
            valign: "top",
            align: "left",
          });
          setProgress(40 + ((index + 1) / pages.length) * 50);
        });

        const blob = (await pptx.write({ outputType: "blob" })) as Blob;
        setProgress(100);
        setResultPptx(blob);
      },
      {
        successMessage: "Converted to PowerPoint successfully!",
        toolName: "pdf-to-powerpoint",
        errorTitle: "Failed to convert to PowerPoint",
        onError: (error) => {
          console.error("Error converting PDF to PowerPoint:", error);
          return error instanceof Error ? error.message : "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!resultPptx) return;
    downloadBlob(resultPptx, "converted.pptx");
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
              <h1>PDF to PowerPoint</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !resultPptx && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !resultPptx && (
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

                <p className="text-sm text-muted-foreground">
                  Each page becomes one slide containing that page&apos;s text — original layout and
                  images aren&apos;t preserved.
                </p>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Converting to PowerPoint" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convertToPowerpoint} disabled={processing}>
                    Convert to PowerPoint
                  </Button>
                  <Button variant="outline" onClick={() => { setFile(null); setResultPptx(null); }} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {resultPptx && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Converted to PowerPoint successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PowerPoint
                  </Button>
                  <Button variant="outline" onClick={() => { setFile(null); setResultPptx(null); }}>
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
