"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { getPdfPageCount, insertPdfPages } from "@/lib/engines/pdf-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface InsertPagesClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function InsertPagesClient({ faqs, related }: InsertPagesClientProps) {
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [targetPageCount, setTargetPageCount] = useState<number>(0);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [position, setPosition] = useState<string>("");
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleTargetSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const selected = newFiles[0];
    setTargetFile(selected);
    setResultPdf(null);

    try {
      const count = await getPdfPageCount(selected);
      setTargetPageCount(count);
      setPosition(String(count));
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF", {
        description: "Please try again with a valid PDF file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      setTargetFile(null);
    }
  };

  const handleSourceSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setSourceFile(newFiles[0]);
      setResultPdf(null);
    }
  };

  const insertPages = () => {
    if (!targetFile || !sourceFile) return;

    run(
      async (setProgress) => {
        setResultPdf(null);
        const atIndex = Number(position);
        if (!Number.isInteger(atIndex) || atIndex < 0 || atIndex > targetPageCount) {
          throw new Error(`Position must be a whole number between 0 and ${targetPageCount}.`);
        }

        setProgress(30);
        const blob = await insertPdfPages(targetFile, sourceFile, atIndex);
        setProgress(100);
        setResultPdf(blob);
      },
      {
        successMessage: "Pages inserted successfully!",
        toolName: "insert-pages",
        errorTitle: "Failed to insert pages",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with valid files",
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "inserted-pages.pdf");
  };

  const clear = () => {
    setTargetFile(null);
    setSourceFile(null);
    setPosition("");
    setResultPdf(null);
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
              <h1>Insert Pages</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!targetFile && !resultPdf && (
              <>
                <p className="text-sm text-muted-foreground">
                  Step 1: upload the PDF you want to insert pages into.
                </p>
                <FileUpload
                  accept={{ "application/pdf": [".pdf"] }}
                  multiple={false}
                  onFilesSelected={handleTargetSelected}
                />
              </>
            )}

            {targetFile && !resultPdf && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{targetFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(targetFile.size / 1024 / 1024).toFixed(2)} MB • {targetPageCount} pages
                    </p>
                  </div>
                </div>

                {!sourceFile ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Step 2: upload the PDF whose pages you want to insert.
                    </p>
                    <FileUpload
                      accept={{ "application/pdf": [".pdf"] }}
                      multiple={false}
                      onFilesSelected={handleSourceSelected}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{sourceFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(sourceFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="insert-position" className="text-sm font-medium">
                        Insert after page (0 = insert at the very start, {targetPageCount} = insert at the end)
                      </label>
                      <input
                        id="insert-position"
                        type="number"
                        min={0}
                        max={targetPageCount}
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      />
                    </div>

                    {processing && (
                      <Progress value={progress} className="h-2" aria-label="Inserting pages" />
                    )}

                    <div className="flex gap-4 flex-wrap">
                      <Button size="lg" onClick={insertPages} disabled={processing || position === ""}>
                        Insert Pages
                      </Button>
                      <Button variant="outline" onClick={clear} disabled={processing}>
                        Clear
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}

            {resultPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Pages inserted successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Insert Into Another PDF
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
