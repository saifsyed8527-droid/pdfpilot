"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, X } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { mergeIntoWorkbook } from "@/lib/engines/excel-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface ExcelSheetMergerClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function ExcelSheetMergerClient({ faqs, related }: ExcelSheetMergerClientProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<Blob | null>(null);
  const { processing, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setResult(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const convert = () => {
    if (files.length < 2) return;

    run(
      async () => {
        setResult(null);
        const blob = await mergeIntoWorkbook(files);
        setResult(blob);
      },
      {
        successMessage: "Merged successfully!",
        toolName: "excel-sheet-merger",
        errorTitle: "Failed to merge Excel files",
        onError: (error) => (error instanceof Error ? error.message : "Please try again"),
      }
    );
  };

  const downloadResult = () => {
    if (!result) return;
    downloadBlob(result, "merged-workbook.xlsx");
  };

  const clear = () => {
    setFiles([]);
    setResult(null);
  };

  return (
    <FileToolLayout toolSlug="excel-sheet-merger" files={files}
      accept={{
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
                  "application/vnd.ms-excel": [".xls"],
                }} multiple={true} onFilesSelected={handleFilesSelected}
      result={result} processing={processing}
      onDownload={downloadResult} onReset={clear} faqs={faqs} related={related}>

            {files.length > 0 && !result && (
              <>
                <div className="space-y-2">
                  {files.map((f, index) => (
                    <div key={`${f.name}-${index}`} className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                      <FileSpreadsheet className="h-6 w-6 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{f.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(f.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFile(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-muted-foreground">
                  Each file&apos;s first sheet becomes its own named sheet in the merged workbook,
                  named after the source file.
                </p>

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convert} disabled={processing || files.length < 2}>
                    Merge Files
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
                <h3 className="text-xl font-semibold">Merged successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download Workbook
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Merge More Files
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
