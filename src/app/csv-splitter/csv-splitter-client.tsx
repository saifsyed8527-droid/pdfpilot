"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { splitCsv } from "@/lib/engines/format-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface CsvSplitterClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function CsvSplitterClient({ faqs, related }: CsvSplitterClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rowsPerFile, setRowsPerFile] = useState(1000);
  const [result, setResult] = useState<{ filename: string; content: string }[] | null>(null);
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
        const chunks = splitCsv(text, rowsPerFile);
        setResult(chunks);
      },
      {
        successMessage: "Split successfully!",
        toolName: "csv-splitter",
        errorTitle: "Failed to split CSV",
        onError: (error) => (error instanceof Error ? error.message : "Please try again"),
      }
    );
  };

  const downloadAll = async () => {
    if (!result) return;
    const { default: JSZip } = await import("jszip");
    const archive = new JSZip();
    for (const chunk of result) archive.file(chunk.filename, chunk.content);
    downloadBlob(await archive.generateAsync({ type: "blob" }), "split-csv-files.zip");
  };

  const clear = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <FileToolLayout toolSlug="csv-splitter" files={[file]}
      accept={{ "text/csv": [".csv"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={result} processing={processing}
      onDownload={downloadAll} onReset={clear} faqs={faqs} related={related}>

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
                  <label htmlFor="rows-per-file" className="text-sm font-medium">
                    Rows per file
                  </label>
                  <input
                    id="rows-per-file"
                    type="number"
                    min={1}
                    value={rowsPerFile}
                    onChange={(e) => setRowsPerFile(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                  <p className="text-sm text-muted-foreground">
                    Every output file repeats the original header row, so each one stays a valid,
                    independently-openable CSV.
                  </p>
                </div>

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convert} disabled={processing}>
                    Split CSV
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
                <h3 className="text-xl font-semibold">
                  Split into {result.length} file{result.length === 1 ? "" : "s"} successfully!
                </h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadAll}>
                    Download ZIP
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Split Another File
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
