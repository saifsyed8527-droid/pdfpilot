"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileJson, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { useProcessingTask } from "@/lib/use-processing-task";
import { compareJson, type JsonDiffLine } from "@/lib/engines/format-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface JsonDiffClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function JsonDiffClient({ faqs, related }: JsonDiffClientProps) {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [diff, setDiff] = useState<JsonDiffLine[] | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFileASelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFileA(newFiles[0]);
      setDiff(null);
    }
  };

  const handleFileBSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFileB(newFiles[0]);
      setDiff(null);
    }
  };

  const compare = () => {
    if (!fileA || !fileB) return;

    run(
      async (setProgress) => {
        setDiff(null);
        setProgress(30);
        const [textA, textB] = await Promise.all([fileA.text(), fileB.text()]);
        setProgress(60);
        const result = await compareJson(textA, textB);
        setProgress(100);
        setDiff(result);
      },
      {
        successMessage: "JSON files compared successfully!",
        toolName: "json-diff",
        errorTitle: "Failed to compare these files",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with valid JSON files",
      }
    );
  };

  const clear = () => {
    setFileA(null);
    setFileB(null);
    setDiff(null);
  };

  const hasChanges = diff?.some((line) => line.added || line.removed) ?? false;

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
              <h1>JSON Diff</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!diff && (
              <>
                <p className="text-sm text-muted-foreground">
                  Compares two JSON files line by line after formatting both consistently, and
                  highlights what changed. Because each object&apos;s key order is preserved as
                  written, the same data with keys in a different order will show as changed —
                  this compares the files as written, not just their underlying data.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Original JSON</p>
                    {fileA ? (
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <FileJson className="h-6 w-6 text-primary shrink-0" />
                        <p className="text-sm font-medium truncate">{fileA.name}</p>
                      </div>
                    ) : (
                      <FileUpload
                        accept={{ "application/json": [".json"] }}
                        multiple={false}
                        onFilesSelected={handleFileASelected}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Revised JSON</p>
                    {fileB ? (
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <FileJson className="h-6 w-6 text-primary shrink-0" />
                        <p className="text-sm font-medium truncate">{fileB.name}</p>
                      </div>
                    ) : (
                      <FileUpload
                        accept={{ "application/json": [".json"] }}
                        multiple={false}
                        onFilesSelected={handleFileBSelected}
                      />
                    )}
                  </div>
                </div>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Comparing JSON files" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={compare} disabled={processing || !fileA || !fileB}>
                    Compare JSON
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {diff && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">
                  {hasChanges ? "Differences found" : "No differences found"}
                </h3>
                <pre className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-xs leading-relaxed max-h-[32rem] overflow-y-auto">
                  {diff.map((line, index) => (
                    <span
                      key={index}
                      className={
                        line.added
                          ? "block bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-200"
                          : line.removed
                            ? "block bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-200"
                            : "block"
                      }
                    >
                      {line.value}
                    </span>
                  ))}
                </pre>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button variant="outline" onClick={clear}>
                    Compare Another Pair
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
