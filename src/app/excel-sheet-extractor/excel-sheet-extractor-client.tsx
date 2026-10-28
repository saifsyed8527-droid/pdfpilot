"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { listSheetNames, extractSheet } from "@/lib/engines/excel-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface ExcelSheetExtractorClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function ExcelSheetExtractorClient({ faqs, related }: ExcelSheetExtractorClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [result, setResult] = useState<Blob | null>(null);
  const { processing, run } = useProcessingTask();

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const newFile = newFiles[0];
    setFile(newFile);
    setResult(null);
    const names = await listSheetNames(newFile);
    setSheetNames(names);
    setSelectedSheet(names[0] ?? "");
  };

  const convert = () => {
    if (!file || !selectedSheet) return;

    run(
      async () => {
        setResult(null);
        const blob = await extractSheet(file, selectedSheet);
        setResult(blob);
      },
      {
        successMessage: "Sheet extracted successfully!",
        toolName: "excel-sheet-extractor",
        errorTitle: "Failed to extract sheet",
        onError: (error) => (error instanceof Error ? error.message : "Please try again"),
      }
    );
  };

  const downloadResult = () => {
    if (!result) return;
    downloadBlob(result, `${selectedSheet || "sheet"}.xlsx`);
  };

  const clear = () => {
    setFile(null);
    setSheetNames([]);
    setSelectedSheet("");
    setResult(null);
  };

  return (
    <FileToolLayout toolSlug="excel-sheet-extractor" files={[file]}
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
                      {sheetNames.length} sheet{sheetNames.length === 1 ? "" : "s"} found
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="sheet-select" className="text-sm font-medium">
                    Sheet to extract
                  </label>
                  <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                    <SelectTrigger id="sheet-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convert} disabled={processing || !selectedSheet}>
                    Extract Sheet
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
                <h3 className="text-xl font-semibold">Sheet extracted successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download Excel
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Extract From Another File
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
