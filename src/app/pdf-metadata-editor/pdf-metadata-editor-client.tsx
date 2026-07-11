"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileSearch, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { readPdfMetadata, writePdfMetadata, type PdfMetadata } from "@/lib/engines/pdf-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

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
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const selected = newFiles[0];
    setFile(selected);
    setResultPdf(null);

    try {
      const metadata = await readPdfMetadata(selected);
      setForm({
        title: metadata.title ?? "",
        author: metadata.author ?? "",
        subject: metadata.subject ?? "",
        keywords: metadata.keywords?.join(", ") ?? "",
        creator: metadata.creator ?? "",
        producer: metadata.producer ?? "",
      });
      setDates({ created: metadata.creationDate, modified: metadata.modificationDate });
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
        setProgress(30);
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

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "metadata-edited.pdf");
  };

  const clear = () => {
    setFile(null);
    setForm(EMPTY_FORM);
    setDates({});
    setResultPdf(null);
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
              <h1>PDF Metadata Editor</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !resultPdf && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !resultPdf && (
              <>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileSearch className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
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
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
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
