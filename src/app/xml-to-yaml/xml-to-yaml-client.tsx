"use client";
import { UiText } from "@/components/i18n/WorkspaceText";


import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileCode } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { xmlToRows, rowsToJson, jsonToYaml } from "@/lib/engines/data-conversion-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface XmlToYamlClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function XmlToYamlClient({ faqs, related }: XmlToYamlClientProps) {
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
        const rows = xmlToRows(text);
        const json = rowsToJson(rows);
        const yaml = await jsonToYaml(json);
        setResult(new Blob([yaml], { type: "application/x-yaml" }));
      },
      {
        successMessage: "Converted to YAML successfully!",
        toolName: "xml-to-yaml",
        errorTitle: "Failed to convert to YAML",
        onError: (error) => (error instanceof Error ? error.message : "Please try again"),
      }
    );
  };

  const downloadResult = () => {
    if (!result) return;
    downloadBlob(result, "converted.yaml");
  };

  const clear = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <FileToolLayout toolSlug="xml-to-yaml" files={[file]}
      accept={{ "application/xml": [".xml"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={result} processing={processing}
      onDownload={downloadResult} onReset={clear} faqs={faqs} related={related}>

            {file && !result && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileCode className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {""}<UiText text={"Expects the"} />{" "}<code>{""}<UiText text={"<rows><row><Field>value</Field></row></rows>"} />{""}</code>{" "}
                  {""}<UiText text={"shape — the same structure this project's other XML conversion tools expect."} />{" "}</p>

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={convert} disabled={processing}>
                    {""}<UiText text={"Convert to YAML"} />{" "}</Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    {""}<UiText text={"Clear"} />{" "}</Button>
                </div>
              </>
            )}

            {result && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">{""}<UiText text={"Converted to YAML successfully!"} />{""}</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    {""}<UiText text={"Download YAML"} />{" "}</Button>
                  <Button variant="outline" onClick={clear}>
                    {""}<UiText text={"Convert Another File"} />{" "}</Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
