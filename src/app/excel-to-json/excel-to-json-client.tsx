"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { readSheetAsRows } from "@/lib/engines/excel-engine";
import { rowsToJson } from "@/lib/engines/data-conversion-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface ExcelToJsonClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function ExcelToJsonClient({ faqs, related }: ExcelToJsonClientProps) {
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
        const rows = await readSheetAsRows(file);
        const json = rowsToJson(rows);
        setResult(new Blob([json], { type: "application/json" }));
      },
      {
        successMessage: "Converted to JSON successfully!",
        toolName: "excel-to-json",
        errorTitle: "Failed to convert to JSON",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid Excel file",
      }
    );
  };

  const downloadResult = () => {
    if (!result) return;
    downloadBlob(result, "converted.json");
  };

  const clear = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <FileToolLayout toolSlug="excel-to-json" files={[file]}
      accept={{
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
                  "application/vnd.ms-excel": [".xls"],
                }} multiple={false} onFilesSelected={handleFilesSelected}
      result={result} processing={processing}
      onDownload={downloadResult} onReset={clear} faqs={faqs} related={related}>

            {file && !result && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Converts the workbook&apos;s first sheet into a JSON array, one object per row,
                  keyed by the header row. Other sheets in a multi-sheet workbook aren&apos;t included.
                </p>

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convert} disabled={processing}>
                    Convert to JSON
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
                <h3 className="text-xl font-semibold">Converted to JSON successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download JSON
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Convert Another File
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
