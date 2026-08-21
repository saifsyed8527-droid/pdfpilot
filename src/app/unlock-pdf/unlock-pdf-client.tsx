"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, ArrowLeft, Unlock, Eye, EyeOff, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { unlockPdf } from "@/lib/engines/pdf-crypto";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface UnlockPdfClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function UnlockPdfClient({ faqs, related }: UnlockPdfClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resultPdf, setResultPdf] = useState<Blob | null>(null);
  const { processing, progress, run, cancel } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResultPdf(null);
      setPassword("");
    }
  };

  const canSubmit = !!file && password.length > 0 && !processing;

  const applyUnlock = () => {
    if (!file || password.length === 0) return;

    run(
      async (setProgress) => {
        setResultPdf(null);
        const blob = await unlockPdf(file, password, (page, total) => {
          const pct = Math.round((page / total) * 90);
          setProgress(pct);
        });
        setProgress(100);
        setResultPdf(blob);
      },
      {
        successMessage: "PDF unlocked successfully!",
        toolName: "unlock-pdf",
        errorTitle: "Failed to unlock PDF",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid PDF file",
      }
    );
  };

  const downloadResult = () => {
    if (!resultPdf) return;
    const name = file?.name?.replace(/\.pdf$/i, "") || "unlocked";
    downloadBlob(resultPdf, `${name}-unlocked.pdf`);
  };

  const clear = () => {
    setFile(null);
    setResultPdf(null);
    setPassword("");
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
              <h1>Unlock PDF</h1>
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
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" aria-hidden />
                  Browser-native unlock — the output is a flattened, image-based PDF (pages are rendered to images and re-embedded). Selectable/copyable text, fonts, links, and form fields from the original aren&apos;t preserved.
                </p>

                <div className="space-y-2">
                  <label htmlFor="unlock-password" className="text-sm font-medium">
                    Open password
                  </label>
                  <div className="relative">
                    <input
                      id="unlock-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full px-3 py-2 pr-10 border rounded-md bg-background"
                      disabled={processing}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {processing && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground/80">
                      {progress >= 90 ? "Almost done…" : "Unlocking…"}
                    </p>
                    <Progress value={progress} className="h-2" aria-label="Unlocking PDF" />
                  </div>
                )}

                <div className="flex gap-4 flex-wrap">
                  {processing ? (
                    <Button variant="outline" onClick={cancel}>
                      Cancel
                    </Button>
                  ) : (
                    <>
                      <Button size="lg" onClick={applyUnlock} disabled={!canSubmit}>
                        <Unlock className="h-4 w-4" />
                        Unlock PDF
                      </Button>
                      <Button variant="outline" onClick={clear}>
                        Clear
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {resultPdf && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Download className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">PDF unlocked successfully!</h3>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    Download Unlocked PDF
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Unlock Another PDF
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
