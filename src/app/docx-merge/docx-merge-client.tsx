"use client";
import { useWorkspaceText, UiText } from "@/components/i18n/WorkspaceText";


import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowUp, ArrowDown, X } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { extractDocxBlocks, buildDocxFromBlocks, type WordBlock } from "@/lib/engines/word-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface DocxMergeClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function DocxMergeClient({ faqs, related }: DocxMergeClientProps) {
  const __copy = useWorkspaceText();
  const [files, setFiles] = useState<File[]>([]);
  const [resultDocx, setResultDocx] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((current) => [...current, ...newFiles]);
    setResultDocx(null);
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    setFiles((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const mergeDocuments = () => {
    if (files.length < 2) return;

    run(
      async (setProgress) => {
        setResultDocx(null);
        const allBlocks: WordBlock[] = [];
        for (let i = 0; i < files.length; i++) {
          const blocks = await extractDocxBlocks(files[i]);
          allBlocks.push(...blocks);
          setProgress(((i + 1) / files.length) * 80);
        }

        if (allBlocks.length === 0) {
          throw new Error("No text content could be extracted from these documents.");
        }

        const blob = await buildDocxFromBlocks(allBlocks);
        setProgress(100);
        setResultDocx(blob);
      },
      {
        successMessage: "Documents merged successfully!",
        toolName: "docx-merge",
        errorTitle: "Failed to merge documents",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with valid .docx files",
      }
    );
  };

  const downloadResult = () => {
    if (!resultDocx) return;
    downloadBlob(resultDocx, "merged.docx");
  };

  const clear = () => {
    setFiles([]);
    setResultDocx(null);
  };

  return (
    <FileToolLayout toolSlug="docx-merge" files={files}
      accept={{
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                  }} multiple={true} onFilesSelected={handleFilesSelected}
      result={resultDocx} processing={processing}
      progress={progress}
      onDownload={downloadResult} onReset={clear} faqs={faqs} related={related}>
            {!resultDocx && (
              <>

                {files.length > 0 && (
                  <ul className="space-y-2">
                    {files.map((file, index) => (
                      <li key={file.name + index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <span className="flex-1 min-w-0 text-sm font-medium truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => moveFile(index, -1)}
                          disabled={index === 0}
                          aria-label={__copy("Move {0} up", [file.name])}
                          className="p-1 rounded hover:bg-background disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFile(index, 1)}
                          disabled={index === files.length - 1}
                          aria-label={__copy("Move {0} down", [file.name])}
                          className="p-1 rounded hover:bg-background disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          aria-label={__copy("Remove {0}", [file.name])}
                          className="p-1 rounded hover:bg-background"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-sm text-muted-foreground">
                  {""}<UiText text={"Documents are combined in the order shown above — each file's headings and paragraphs are appended in sequence. Formatting, images, and tables aren't preserved."} />{" "}</p>

                {processing && (
                  <Progress value={progress} className="h-2" aria-label={__copy("Merging documents")} />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={mergeDocuments} disabled={processing || files.length < 2}>
                    {""}<UiText text={"Merge Documents"} />{" "}</Button>
                  <Button variant="outline" onClick={clear} disabled={processing || files.length === 0}>
                    {""}<UiText text={"Clear"} />{" "}</Button>
                </div>
              </>
            )}

            {resultDocx && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">{""}<UiText text={"Documents merged successfully!"} />{""}</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    {""}<UiText text={"Download DOCX"} />{" "}</Button>
                  <Button variant="outline" onClick={clear}>
                    {""}<UiText text={"Merge More Documents"} />{" "}</Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
