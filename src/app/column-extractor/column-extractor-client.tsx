"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { extractCsvColumns } from "@/lib/engines/format-engine";
import { parseCsv } from "@/lib/engines/text-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface ColumnExtractorClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function ColumnExtractorClient({ faqs, related }: ColumnExtractorClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [result, setResult] = useState<Blob | null>(null);
  const { processing, run } = useProcessingTask();

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const newFile = newFiles[0];
    setFile(newFile);
    setResult(null);
    const text = await newFile.text();
    const rows = parseCsv(text);
    const header = rows[0] ?? [];
    setHeaders(header);
    setSelected(header.map((_, i) => i));
  };

  const toggleColumn = (index: number) => {
    setSelected((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };

  const convert = () => {
    if (!file) return;

    run(
      async () => {
        setResult(null);
        const text = await file.text();
        const extracted = extractCsvColumns(text, selected);
        setResult(new Blob([extracted], { type: "text/csv" }));
      },
      {
        successMessage: "Columns extracted successfully!",
        toolName: "column-extractor",
        errorTitle: "Failed to extract columns",
        onError: (error) => (error instanceof Error ? error.message : "Please try again"),
      }
    );
  };

  const downloadResult = () => {
    if (!result) return;
    downloadBlob(result, "extracted-columns.csv");
  };

  const clear = () => {
    setFile(null);
    setHeaders([]);
    setSelected([]);
    setResult(null);
  };

  return (
    <FileToolLayout toolSlug="column-extractor" files={[file]}
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

                <div className="space-y-2">
                  <p className="text-sm font-medium">Select columns to keep</p>
                  <div className="flex flex-wrap gap-2">
                    {headers.map((header, index) => (
                      <button
                        key={`${header}-${index}`}
                        type="button"
                        onClick={() => toggleColumn(index)}
                        className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                          selected.includes(index)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border text-muted-foreground"
                        }`}
                      >
                        {header || `Column ${index + 1}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convert} disabled={processing || selected.length === 0}>
                    Extract Columns
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
                <h3 className="text-xl font-semibold">Columns extracted successfully!</h3>
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
