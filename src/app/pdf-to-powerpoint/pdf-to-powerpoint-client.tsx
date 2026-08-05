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
import { getPdfBasicInfo } from "@/lib/engines/pdf-engine";
import { renderPdfPages } from "@/lib/engines/pdf-render-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface PdfToPowerpointClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function PdfToPowerpointClient({ faqs, related }: PdfToPowerpointClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultPptx, setResultPptx] = useState<Blob | null>(null);
  const { processing, progress, run, cancel } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultPptx(null);
    }
  };

  const convertToPowerpoint = () => {
    if (!file) return;

    run(
      async (setProgress, isCancelled) => {
        setResultPptx(null);

        // Real page-1 dimensions (in PDF points) set the presentation's
        // slide size, so every slide's image fills the frame exactly
        // instead of floating inside a generic 4:3/16:9 layout with
        // mismatched margins on every side.
        const { firstPageSize } = await getPdfBasicInfo(file);
        const layoutWidthIn = firstPageSize.width / 72;
        const layoutHeightIn = firstPageSize.height / 72;

        const PptxGenJS = (await import("pptxgenjs")).default;
        const pptx = new PptxGenJS();
        pptx.defineLayout({ name: "PDF_PAGE", width: layoutWidthIn, height: layoutHeightIn });
        pptx.layout = "PDF_PAGE";

        // Each page is rendered as a real image and placed full-bleed on
        // its own slide — this is what actually makes the output "PDF to
        // PowerPoint" rather than "PDF text to PowerPoint": the deck looks
        // like the source document (layout, images, colors, fonts as
        // they actually appear), which plain text extraction can never
        // do. The trade-off is disclosed in the FAQ below: the text in
        // each slide is part of the image, not a selectable/editable text
        // box - a real PowerPoint would need to add its own text over it
        // to edit the words. Scale 2 matches PDF to JPG's existing
        // quality-output default (roughly 144 DPI from a 72-DPI page).
        await renderPdfPages(file, 2, undefined, (page, totalPages) => {
          if (isCancelled()) return;
          const slide = pptx.addSlide();
          slide.addImage({
            data: page.canvas.toDataURL("image/jpeg", 0.85),
            x: 0,
            y: 0,
            w: layoutWidthIn,
            h: layoutHeightIn,
          });
          setProgress((page.pageNumber / totalPages) * 90);
        });

        if (isCancelled()) return;

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
          // Matches Merge PDF's established pattern: never surface pdf-lib's
          // raw error.message (e.g. "Cannot read properties of undefined
          // (reading 'Pages')" for malformed PDFs) - it's an internal
          // implementation detail, not something a user can act on.
          const message = error instanceof Error ? error.message : "";
          return message.includes("is encrypted")
            ? "This PDF is password-protected. Please remove the password and try again."
            : "Please try again with a valid PDF file";
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
                  Each page becomes one slide showing an exact image of that page — the layout,
                  images, and design all carry over. The text in the image isn&apos;t selectable or
                  editable in PowerPoint; add a text box on top if you need to edit words.
                </p>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Converting to PowerPoint" />
                )}

                <div className="flex gap-4 flex-wrap">
                  {processing ? (
                    <Button variant="outline" size="lg" onClick={cancel}>
                      Cancel
                    </Button>
                  ) : (
                    <>
                      <Button size="lg" onClick={convertToPowerpoint}>
                        Convert to PowerPoint
                      </Button>
                      <Button variant="outline" onClick={() => { setFile(null); setResultPptx(null); }}>
                        Clear
                      </Button>
                    </>
                  )}
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
