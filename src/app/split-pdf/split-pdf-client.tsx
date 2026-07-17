"use client";

import { useMemo, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { selectedPagesToRanges, rangesToString } from "@/lib/pdf-page-ranges";
import { PageThumbnailGrid, type PageThumbnail } from "@/components/pdf/PageThumbnailGrid";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface SplitPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

interface SplitOutput {
  blob: Blob;
  label: string;
  pageCount: number;
  previewDataUrl: string | null;
}

export function SplitPdfClient({ faqs, related }: SplitPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [outputs, setOutputs] = useState<SplitOutput[]>([]);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setSelectedPages(new Set());
      setThumbnails([]);
      setOutputs([]);
    }
  };

  const togglePage = (pageIndex: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        next.add(pageIndex);
      }
      return next;
    });
  };

  const ranges = useMemo(() => selectedPagesToRanges(selectedPages), [selectedPages]);
  const rangeSummary = useMemo(() => rangesToString(ranges), [ranges]);

  const splitPDF = () => {
    if (!file || ranges.length === 0) return;

    run(
      async (setProgress) => {
        setOutputs([]);
        const { PDFDocument } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const totalPages = pdf.getPageCount();
        const results: SplitOutput[] = [];

        for (let i = 0; i < ranges.length; i++) {
          const [start, end] = ranges[i];
          const newPdf = await PDFDocument.create();
          const pagesToCopy: number[] = [];

          for (let page = start; page <= end; page++) {
            if (page > 0 && page <= totalPages) {
              pagesToCopy.push(page - 1);
            }
          }

          const copiedPages = await newPdf.copyPages(pdf, pagesToCopy);
          copiedPages.forEach((page) => newPdf.addPage(page));

          const pdfBytes = await newPdf.save();
          const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

          // Reuses the thumbnail already rendered for this group's first
          // page (from the same source file) instead of rendering the new
          // output blob again — same visual content, zero extra pdfjs work.
          const previewDataUrl = thumbnails[start - 1]?.dataUrl ?? null;

          results.push({
            blob,
            label: rangesToString([[start, end]]),
            pageCount: pagesToCopy.length,
            previewDataUrl,
          });
          setProgress(((i + 1) / ranges.length) * 100);
        }

        setOutputs(results);
      },
      {
        successMessage: "PDF split successfully!",
        toolName: "split-pdf",
        errorTitle: "Failed to split PDF",
        onError: (error) => {
          console.error("Error splitting PDF:", error);
          return "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadAll = () => {
    outputs.forEach((output) => {
      downloadBlob(output.blob, `split-${output.label.replace(/,/g, "_")}.pdf`);
    });
  };

  const clear = () => {
    setFile(null);
    setSelectedPages(new Set());
    setThumbnails([]);
    setOutputs([]);
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
              <h1>Split PDF</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && outputs.length === 0 && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && outputs.length === 0 && (
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

                <PageThumbnailGrid
                  file={file}
                  selected={selectedPages}
                  onToggle={togglePage}
                  onPagesLoaded={(count) => {
                    setPageCount(count);
                    setSelectedPages(new Set(Array.from({ length: count }, (_, i) => i)));
                  }}
                  onThumbnailsReady={setThumbnails}
                  onError={(error) => {
                    console.error("Error rendering PDF pages:", error);
                  }}
                />

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i)))}
                      disabled={processing}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPages(new Set())}
                      disabled={processing}
                    >
                      Clear Selection
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {ranges.length === 0
                      ? "Select at least one page"
                      : `${ranges.length} file${ranges.length === 1 ? "" : "s"} will be created: ${rangeSummary}`}
                  </p>
                </div>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Splitting PDF" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={splitPDF} disabled={processing || ranges.length === 0}>
                    Split PDF
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {outputs.length > 0 && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
                    <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold">PDF split successfully!</h3>
                  <p className="text-muted-foreground">{outputs.length} files created</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {outputs.map((output, index) => (
                    <div key={index} className="rounded-lg border overflow-hidden bg-muted/40">
                      {output.previewDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot of the actual output file
                        <img src={output.previewDataUrl} alt={`Preview of pages ${output.label}`} className="w-full h-auto block" />
                      ) : (
                        <div className="aspect-[3/4] flex items-center justify-center bg-muted">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-2 space-y-1">
                        <p className="text-xs font-medium truncate">
                          Pages {output.label} ({output.pageCount} page{output.pageCount === 1 ? "" : "s"})
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => downloadBlob(output.blob, `split-${output.label.replace(/,/g, "_")}.pdf`)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadAll}>
                    Download All
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Split Another PDF
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
