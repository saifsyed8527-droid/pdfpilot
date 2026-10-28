"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileJson } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { useProcessingTask } from "@/lib/use-processing-task";
import { compareJson, type JsonDiffLine } from "@/lib/engines/format-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

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
        const [textA, textB] = await Promise.all([fileA.text(), fileB.text()]);
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
    <FileToolLayout toolSlug="json-diff" files={[fileA, fileB]}
      accept={{ "application/json": [".json"] }} multiple={false} onFilesSelected={handleFileASelected}
      result={diff} processing={processing}
      progress={progress} onReset={clear} faqs={faqs} related={related}>
            {!diff && (
              <>
                <p className="text-sm text-muted-foreground">
                  Compares two JSON files line by line after formatting both consistently, and
                  highlights what changed. Because each object&apos;s key order is preserved as
                  written, the same data with keys in a different order will show as changed —
                  this compares the files as written, not just their underlying data.
                </p>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Original JSON</p>
                    {fileA ? (
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <FileJson className="h-6 w-6 text-primary shrink-0" />
                        <p className="text-sm font-medium truncate">{fileA.name}</p>
                      </div>
                    ) : null}
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

    </FileToolLayout>
  );
}
