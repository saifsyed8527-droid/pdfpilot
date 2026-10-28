"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, FileSearch, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import {
  readPdfMetadata,
  writePdfMetadata,
  clearPdfMetadata,
  getPdfPageCount,
  type PdfMetadata,
} from "@/lib/engines/pdf-engine";
import type { ResolvedEntity } from "@/lib/content/registry";

interface PdfMetadataEditorClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

interface MetadataFormState {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
}

const EMPTY_FORM: MetadataFormState = {
  title: "",
  author: "",
  subject: "",
  keywords: "",
  creator: "",
  producer: "",
};

export function PdfMetadataEditorClient({ faqs, related }: PdfMetadataEditorClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<MetadataFormState>(EMPTY_FORM);
  const [dates, setDates] = useState<{ created?: Date; modified?: Date }>({});
  const [pageCount, setPageCount] = useState<number>(0);
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const selected = newFiles[0];
    setFile(selected);
    setResultPdf(null);

    try {
      const [metadata, count] = await Promise.all([
        readPdfMetadata(selected),
        getPdfPageCount(selected),
      ]);
      setForm({
        title: metadata.title ?? "",
        author: metadata.author ?? "",
        subject: metadata.subject ?? "",
        keywords: metadata.keywords?.join(", ") ?? "",
        creator: metadata.creator ?? "",
        producer: metadata.producer ?? "",
      });
      setDates({ created: metadata.creationDate, modified: metadata.modificationDate });
      setPageCount(count);
    } catch (error) {
      console.error("Error reading PDF metadata:", error);
      toast.error("Failed to read PDF", {
        description: "Please try again with a valid PDF file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      setFile(null);
    }
  };

  const saveMetadata = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultPdf(null);
        const updates: PdfMetadata = {
          title: form.title,
          author: form.author,
          subject: form.subject,
          keywords: form.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          creator: form.creator,
          producer: form.producer,
        };
        const blob = await writePdfMetadata(file, updates);
        setProgress(100);
        setResultPdf(blob);
      },
      {
        successMessage: "Metadata saved successfully!",
        toolName: "pdf-metadata-editor",
        errorTitle: "Failed to save metadata",
        onError: (error) => {
          console.error("Error saving PDF metadata:", error);
          return error instanceof Error ? error.message : "Please try again with a valid PDF file";
        },
      }
    );
  };

  const clearAllMetadata = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultPdf(null);
        const blob = await clearPdfMetadata(file);
        setProgress(100);
        setForm(EMPTY_FORM);
        setResultPdf(blob);
      },
      {
        successMessage: "Metadata cleared successfully!",
        toolName: "pdf-metadata-editor",
        errorTitle: "Failed to clear metadata",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid PDF file",
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "metadata-edited.pdf");
  };

  const clear = () => {
    setFile(null);
    setForm(EMPTY_FORM);
    setDates({});
    setPageCount(0);
    setResultPdf(null);
  };

  return (
    <FileToolLayout toolSlug="pdf-metadata-editor" files={[file]}
      accept={{ "application/pdf": [".pdf"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={resultPdf} processing={processing}
      progress={progress}
      onDownload={downloadResult} onReset={clear} faqs={faqs} related={related}>

            {file && !resultPdf && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileSearch className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {pageCount} pages
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="meta-title" className="text-sm font-medium">Title</label>
                    <input
                      id="meta-title"
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="meta-author" className="text-sm font-medium">Author</label>
                    <input
                      id="meta-author"
                      type="text"
                      value={form.author}
                      onChange={(e) => setForm({ ...form, author: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="meta-subject" className="text-sm font-medium">Subject</label>
                    <input
                      id="meta-subject"
                      type="text"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="meta-keywords" className="text-sm font-medium">Keywords (comma-separated)</label>
                    <input
                      id="meta-keywords"
                      type="text"
                      value={form.keywords}
                      onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="meta-creator" className="text-sm font-medium">Creator</label>
                    <input
                      id="meta-creator"
                      type="text"
                      value={form.creator}
                      onChange={(e) => setForm({ ...form, creator: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="meta-producer" className="text-sm font-medium">Producer</label>
                    <input
                      id="meta-producer"
                      type="text"
                      value={form.producer}
                      onChange={(e) => setForm({ ...form, producer: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                </div>

                {(dates.created || dates.modified) && (
                  <p className="text-sm text-muted-foreground">
                    {dates.created && <>Created: {dates.created.toLocaleString()}</>}
                    {dates.created && dates.modified && " · "}
                    {dates.modified && <>Modified: {dates.modified.toLocaleString()}</>}
                  </p>
                )}

                {processing && (
                  <Progress value={progress} className="h-2" aria-label="Saving metadata" />
                )}

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={saveMetadata} disabled={processing}>
                    Save Metadata
                  </Button>
                  <Button variant="outline" onClick={clearAllMetadata} disabled={processing}>
                    Clear All Metadata
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Start Over
                  </Button>
                </div>
              </>
            )}

            {resultPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">Metadata saved successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Edit Another PDF
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
