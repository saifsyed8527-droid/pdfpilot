"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { deduplicateCsvRows } from "@/lib/engines/format-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface DuplicateRowRemoverClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function DuplicateRowRemoverClient({ faqs, related }: DuplicateRowRemoverClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const { processing, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResult(null);
    }
  };

  const convert = () => {
    if (!file) return;

    run(
      async () => {
        setResult(null);
        const text = await file.text();
        const deduped = deduplicateCsvRows(text);
        setResult(new Blob([deduped], { type: "text/csv" }));
      },
      {
        successMessage: "Duplicates removed successfully!",
        toolName: "duplicate-row-remover",
        errorTitle: "Failed to remove duplicates",
        onError: (error) => (error instanceof Error ? error.message : "Please try again"),
      }
    );
  };

  const downloadResult = () => {
    if (!result) return;
    downloadBlob(result, "deduplicated.csv");
  };

  const clear = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <FileToolLayout toolSlug="duplicate-row-remover" files={[file]}
      accept={{ "text/csv": [".csv"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={result} processing={processing}
      onDownload={downloadResult} onReset={clear} faqs={faqs} related={related}>

            {file && !result && (
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
                  Removes rows that exactly match an earlier row, keeping the first occurrence.
                  Comparison is exact — case and whitespace sensitive.
                </p>

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convert} disabled={processing}>
                    Remove Duplicates
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {result && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Duplicates removed successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download CSV
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Process Another File
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
