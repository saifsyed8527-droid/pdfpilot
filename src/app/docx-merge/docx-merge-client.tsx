"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft, ArrowUp, ArrowDown, X } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { extractDocxBlocks, buildDocxFromBlocks, type WordBlock } from "@/lib/engines/word-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface DocxMergeClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function DocxMergeClient({ faqs, related }: DocxMergeClientProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [resultDocx, setResultDocx] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((current) => [...current, ...newFiles]);
    setResultDocx(null);
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    setFiles((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const mergeDocuments = () => {
    if (files.length < 2) return;

    run(
      async (setProgress) => {
        setResultDocx(null);
        const allBlocks: WordBlock[] = [];
        for (let i = 0; i < files.length; i++) {
          const blocks = await extractDocxBlocks(files[i]);
          allBlocks.push(...blocks);
          setProgress(((i + 1) / files.length) * 80);
        }

        if (allBlocks.length === 0) {
          throw new Error("No text content could be extracted from these documents.");
        }

        const blob = await buildDocxFromBlocks(allBlocks);
        setProgress(100);
        setResultDocx(blob);
      },
      {
        successMessage: "Documents merged successfully!",
        toolName: "docx-merge",
        errorTitle: "Failed to merge documents",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with valid .docx files",
      }
    );
  };

  const downloadResult = () => {
    if (!resultDocx) return;
    downloadBlob(resultDocx, "merged.docx");
  };

  const clear = () => {
    setFiles([]);
    setResultDocx(null);
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
              <h1>DOCX Merge</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!resultDocx && (
              <>
                <FileUpload
                  accept={{
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                  }}
                  multiple
                  onFilesSelected={handleFilesSelected}
                />

                {files.length > 0 && (
                  <ul className="space-y-2">
                    {files.map((file, index) => (
                      <li key={file.name + index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <span className="flex-1 min-w-0 text-sm font-medium truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => moveFile(index, -1)}
                          disabled={index === 0}
                          aria-label={`Move ${file.name} up`}
                          className="p-1 rounded hover:bg-background disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFile(index, 1)}
                          disabled={index === files.length - 1}
                          aria-label={`Move ${file.name} down`}
                          className="p-1 rounded hover:bg-background disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          aria-label={`Remove ${file.name}`}
                          className="p-1 rounded hover:bg-background"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-sm text-muted-foreground">
                  Documents are combined in the order shown above — each file&apos;s headings and
                  paragraphs are appended in sequence. Formatting, images, and tables aren&apos;t
                  preserved.
                </p>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Merging documents" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={mergeDocuments} disabled={processing || files.length < 2}>
                    Merge Documents
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing || files.length === 0}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {resultDocx && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Documents merged successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download DOCX
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Merge More Documents
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
