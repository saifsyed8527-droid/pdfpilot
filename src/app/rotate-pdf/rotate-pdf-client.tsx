"use client";

import { useMemo, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft, RotateCcw, RotateCw } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { PageThumbnailGrid, type PageThumbnail } from "@/components/pdf/PageThumbnailGrid";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface RotatePdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;

export function RotatePdfClient({ faqs, related }: RotatePdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ blob: Blob; previewDataUrl: string | null } | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setThumbnails([]);
      setPageRotations({});
      setResult(null);
    }
  };

  const rotatePage = (pageIndex: number, delta: number) => {
    setPageRotations((prev) => ({
      ...prev,
      [pageIndex]: normalizeAngle((prev[pageIndex] ?? 0) + delta),
    }));
  };

  const rotateAll = (delta: number) => {
    setPageRotations((prev) => {
      const next: Record<number, number> = { ...prev };
      for (let i = 0; i < pageCount; i++) {
        next[i] = normalizeAngle((prev[i] ?? 0) + delta);
      }
      return next;
    });
  };

  const resetRotations = () => setPageRotations({});

  const changedPageCount = useMemo(
    () => Object.values(pageRotations).filter((angle) => angle !== 0).length,
    [pageRotations]
  );

  const applyRotations = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResult(null);
        const { PDFDocument, degrees } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = pdf.getPages();

        pages.forEach((page, index) => {
          const delta = pageRotations[index] ?? 0;
          if (delta !== 0) {
            const currentAngle = page.getRotation().angle;
            page.setRotation(degrees(normalizeAngle(currentAngle + delta)));
          }
          setProgress(((index + 1) / pages.length) * 100);
        });

        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

        // Reuses the already-rendered first-page thumbnail for the
        // confirmation preview, with its final rotation applied via CSS —
        // no second pdfjs render needed for a one-page confirmation shot.
        const previewDataUrl = thumbnails[0]?.dataUrl ?? null;
        setResult({ blob, previewDataUrl });
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

  const downloadResult = () => {
    if (!result) return;
    downloadBlob(result.blob, "rotated.pdf");
  };

  const clear = () => {
    setFile(null);
    setThumbnails([]);
    setPageRotations({});
    setResult(null);
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
            {!file && !result && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !result && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB{pageCount > 0 ? ` • ${pageCount} pages` : ""}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Rotate individual pages, or rotate every page at once — useful when only a few
                  pages of a scanned document came out sideways.
                </p>

                <PageThumbnailGrid
                  file={file}
                  pageRotations={pageRotations}
                  renderPageAction={(pageIndex) => (
                    <>
                      <button
                        type="button"
                        aria-label={`Rotate page ${pageIndex + 1} counterclockwise`}
                        onClick={() => rotatePage(pageIndex, -90)}
                        className="h-6 w-6 flex items-center justify-center rounded bg-background/90 border border-border hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Rotate page ${pageIndex + 1} clockwise`}
                        onClick={() => rotatePage(pageIndex, 90)}
                        className="h-6 w-6 flex items-center justify-center rounded bg-background/90 border border-border hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </>
                  )}
                  onPagesLoaded={setPageCount}
                  onThumbnailsReady={setThumbnails}
                  onError={(error) => {
                    console.error("Error rendering PDF pages:", error);
                  }}
                />

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => rotateAll(90)} disabled={processing}>
                      <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                      Rotate All Clockwise
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => rotateAll(-90)} disabled={processing}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Rotate All Counterclockwise
                    </Button>
                    <Button variant="outline" size="sm" onClick={resetRotations} disabled={processing}>
                      Reset
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {changedPageCount === 0
                      ? "No pages rotated yet"
                      : `${changedPageCount} of ${pageCount} page${pageCount === 1 ? "" : "s"} will be rotated`}
                  </p>
                </div>

                {processing && <Progress value={progress} className="h-2" aria-label="Rotating PDF" />}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={applyRotations} disabled={processing || changedPageCount === 0}>
                    Rotate PDF
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {result && (
              <div className="space-y-4 text-center">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">PDF rotated successfully!</h3>
                {result.previewDataUrl && (
                  <div className="w-32 mx-auto rounded-lg border overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot */}
                    <img
                      src={result.previewDataUrl}
                      alt="Preview of the first page after rotation"
                      className="w-full h-auto block"
                      style={pageRotations[0] ? { transform: `rotate(${pageRotations[0]}deg)` } : undefined}
                    />
                  </div>
                )}
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={clear}>
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
