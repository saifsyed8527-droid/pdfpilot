"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { xmlToRows, rowsToXlsx } from "@/lib/engines/data-conversion-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface XmlToExcelClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function XmlToExcelClient({ faqs, related }: XmlToExcelClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultXlsx, setResultXlsx] = useState<Blob | null>(null);
  const { processing, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultXlsx(null);
    }
  };

  const convertToExcel = () => {
    if (!file) return;

    run(
      async () => {
        setResultXlsx(null);
        const text = await file.text();
        const rows = xmlToRows(text);
        const blob = await rowsToXlsx(rows);
        setResultXlsx(blob);
      },
      {
        successMessage: "Converted to Excel successfully!",
        toolName: "xml-to-excel",
        errorTitle: "Failed to convert to Excel",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid .xml file",
      }
    );
  };

  const downloadResult = () => {
    if (!resultXlsx) return;
    downloadBlob(resultXlsx, "converted.xlsx");
  };

  const clear = () => {
    setFile(null);
    setResultXlsx(null);
  };

  return (
    <FileToolLayout toolSlug="xml-to-excel" files={[file]}
      accept={{ "text/xml": [".xml"], "application/xml": [".xml"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={resultXlsx} processing={processing}
      onDownload={downloadResult} onReset={clear} faqs={faqs} related={related}>

            {file && !resultXlsx && (
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
                  Expects <code>&lt;rows&gt;&lt;row&gt;&lt;Field&gt;value&lt;/Field&gt;&lt;/row&gt;&lt;/rows&gt;</code> —
                  the same structure this site&apos;s Excel to XML and CSV to XML tools produce.
                  Produces a real, openable .xlsx file with one sheet.
                </p>

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convertToExcel} disabled={processing}>
                    Convert to Excel
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {resultXlsx && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Converted to Excel successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download Excel File
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
