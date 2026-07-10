"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft, AlertCircle, Loader2, Info } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

type FieldType = "text" | "checkbox" | "dropdown" | "radio";

interface DetectedField {
  name: string;
  type: FieldType;
  options?: string[];
}

type FieldValues = Record<string, string | boolean>;

interface FillPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function FillPdfClient({ faqs, related }: FillPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loadingFields, setLoadingFields] = useState(false);
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [unsupportedCount, setUnsupportedCount] = useState(0);
  const [values, setValues] = useState<FieldValues>({});
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run } = useProcessingTask();

  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const pdfFile = newFiles[0];
    setFile(pdfFile);
    setResultPdf(null);
    setLoadingFields(true);

    try {
      const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } = await import(
        "pdf-lib"
      );
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const form = pdf.getForm();
      const allFields = form.getFields();

      const detected: DetectedField[] = [];
      const initialValues: FieldValues = {};
      let unsupported = 0;

      for (const field of allFields) {
        const name = field.getName();
        if (field instanceof PDFTextField) {
          detected.push({ name, type: "text" });
          initialValues[name] = field.getText() ?? "";
        } else if (field instanceof PDFCheckBox) {
          detected.push({ name, type: "checkbox" });
          initialValues[name] = field.isChecked();
        } else if (field instanceof PDFDropdown) {
          detected.push({ name, type: "dropdown", options: field.getOptions() });
          initialValues[name] = field.getSelected()[0] ?? "";
        } else if (field instanceof PDFRadioGroup) {
          detected.push({ name, type: "radio", options: field.getOptions() });
          initialValues[name] = field.getSelected() ?? "";
        } else {
          unsupported += 1;
        }
      }

      setDetectedFields(detected);
      setUnsupportedCount(unsupported);
      setValues(initialValues);
    } catch (error) {
      console.error("Error reading PDF form fields:", error);
      toast.error("Failed to load PDF", {
        description: "Please try again with a valid PDF file",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      setFile(null);
    } finally {
      setLoadingFields(false);
    }
  };

  const setFieldValue = (name: string, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const fillPdf = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResultPdf(null);
        const { PDFDocument } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const form = pdf.getForm();

        detectedFields.forEach((field, index) => {
          const value = values[field.name];
          if (field.type === "text") {
            form.getTextField(field.name).setText(String(value ?? ""));
          } else if (field.type === "checkbox") {
            const checkBox = form.getCheckBox(field.name);
            if (value) checkBox.check();
            else checkBox.uncheck();
          } else if (field.type === "dropdown") {
            if (value) form.getDropdown(field.name).select(String(value));
          } else if (field.type === "radio") {
            if (value) form.getRadioGroup(field.name).select(String(value));
          }
          setProgress(((index + 1) / detectedFields.length) * 100);
        });

        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        setResultPdf(blob);
      },
      {
        successMessage: "PDF filled successfully!",
        toolName: "fill-pdf",
        errorTitle: "Failed to fill PDF",
        onError: (error) => {
          console.error("Error filling PDF:", error);
          return "Please try again with a valid PDF file";
        },
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    downloadBlob(resultPdf, "filled.pdf");
  };

  const reset = () => {
    setFile(null);
    setDetectedFields([]);
    setValues({});
    setResultPdf(null);
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl md:text-3xl">
              <h1>Fill PDF</h1>
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

            {loadingFields && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                <p role="status">Reading form fields…</p>
              </div>
            )}

            {file && !loadingFields && !resultPdf && (
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

                {detectedFields.length === 0 ? (
                  <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
                    <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      No fillable fields were found in this PDF. Fill PDF only works with PDFs
                      that already contain a fillable form — it can&apos;t add new fields to a
                      regular document.
                    </p>
                  </div>
                ) : (
                  <>
                    {unsupportedCount > 0 && (
                      <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
                        <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm text-muted-foreground">
                          {unsupportedCount} field{unsupportedCount > 1 ? "s" : ""} in this PDF
                          {unsupportedCount > 1 ? " aren't" : " isn't"} a supported type (list
                          boxes, signatures, and buttons aren&apos;t supported yet) and won&apos;t
                          be shown below.
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      {detectedFields.map((field) => (
                        <div key={field.name} className="space-y-2">
                          <label htmlFor={`field-${field.name}`} className="text-sm font-medium">
                            {field.name}
                          </label>

                          {field.type === "text" && (
                            <input
                              id={`field-${field.name}`}
                              type="text"
                              value={String(values[field.name] ?? "")}
                              onChange={(e) => setFieldValue(field.name, e.target.value)}
                              className="w-full px-3 py-2 border rounded-md bg-background"
                            />
                          )}

                          {field.type === "checkbox" && (
                            <div className="flex items-center gap-2">
                              <input
                                id={`field-${field.name}`}
                                type="checkbox"
                                checked={Boolean(values[field.name])}
                                onChange={(e) => setFieldValue(field.name, e.target.checked)}
                                className="h-4 w-4"
                              />
                            </div>
                          )}

                          {(field.type === "dropdown" || field.type === "radio") && (
                            <Select
                              value={String(values[field.name] ?? "")}
                              onValueChange={(v) => setFieldValue(field.name, v)}
                            >
                              <SelectTrigger id={`field-${field.name}`}>
                                <SelectValue placeholder="Choose an option" />
                              </SelectTrigger>
                              <SelectContent>
                                {(field.options ?? []).map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                    </div>

                    {processing && (
                      <Progress value={progress} className="h-2" aria-label="Filling PDF" />
                    )}

                    <div className="flex gap-4 flex-wrap">
                      <Button size="lg" onClick={fillPdf} disabled={processing}>
                        Fill PDF
                      </Button>
                      <Button variant="outline" onClick={reset} disabled={processing}>
                        Clear
                      </Button>
                    </div>
                  </>
                )}

                {detectedFields.length === 0 && (
                  <Button variant="outline" onClick={reset}>
                    Try Another PDF
                  </Button>
                )}
              </>
            )}

            {resultPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">PDF filled successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    Fill Another PDF
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
