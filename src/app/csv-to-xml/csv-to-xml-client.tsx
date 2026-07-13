"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { parseCsv } from "@/lib/engines/text-engine";
import { rowsToXml } from "@/lib/engines/data-conversion-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface CsvToXmlClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function CsvToXmlClient({ faqs, related }: CsvToXmlClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [resultXml, setResultXml] = useState<Blob | null>(null);
  const { processing, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultXml(null);
    }
  };

  const convertToXml = () => {
    if (!file) return;

    run(
      async () => {
        setResultXml(null);
        const text = await file.text();
        const rows = parseCsv(text);
        const xml = rowsToXml(rows);
        setResultXml(new Blob([xml], { type: "application/xml" }));
      },
      {
        successMessage: "Converted to XML successfully!",
        toolName: "csv-to-xml",
        errorTitle: "Failed to convert to XML",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid .csv file",
      }
    );
  };

  const downloadResult = () => {
    if (!resultXml) return;
    downloadBlob(resultXml, "converted.xml");
  };

  const clear = () => {
    setFile(null);
    setResultXml(null);
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
              <h1>CSV to XML</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !resultXml && (
              <FileUpload
                accept={{ "text/csv": [".csv"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !resultXml && (
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
                  Each row becomes a <code>&lt;row&gt;</code> element with one child element per
                  column, named after that column&apos;s header. The header row itself becomes the
                  element names, not a row of data.
                </p>

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convertToXml} disabled={processing}>
                    Convert to XML
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {resultXml && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Converted to XML successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download XML
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Convert Another File
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
