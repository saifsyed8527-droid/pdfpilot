"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  FileText,
  ArrowLeft,
  Sparkles,
  Copy,
  Check,
  ListBullet,
  AlignLeft,
  ZoomIn,
} from "lucide-react";
import Link from "next/link";
import type { FaqInput } from "@/lib/seo";
import { downloadBlob } from "@/lib/download-file";
import { useProcessingTask } from "@/lib/use-processing-task";
import { summarizePdf, type SummaryResult } from "@/lib/engines/summary-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface SummaryGeneratorClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

type SummaryLength = "short" | "medium" | "long";

const RATIO: Record<SummaryLength, number> = {
  short: 0.1,
  medium: 0.2,
  long: 0.35,
};

const LENGTH_LABEL: Record<SummaryLength, string> = {
  short: "Short (10%)",
  medium: "Medium (20%)",
  long: "Long (35%)",
};

export function SummaryGeneratorClient({ faqs, related }: SummaryGeneratorClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [length, setLength] = useState<SummaryLength>("medium");
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [copied, setCopied] = useState(false);
  const { processing, progress, run, cancel } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResult(null);
      setCopied(false);
    }
  };

  const canSubmit = !!file && !processing;

  const doSummary = () => {
    if (!file) return;

    run(
      async (setProgress) => {
        setResult(null);
        setCopied(false);
        setProgress(20);
        const r = await summarizePdf(file, RATIO[length]);
        setProgress(100);
        setResult(r);
      },
      {
        successMessage: "Summary generated successfully!",
        toolName: "summary-generator",
        errorTitle: "Failed to generate summary",
        onError: (error) =>
          error instanceof Error ? error.message : "Please try again with a valid PDF file",
      }
    );
  };

  const downloadResult = () => {
    if (!result) return;
    const lines = result.bulletPoints.map((b) => `• ${b}`).join("\n\n");
    const text =
      `PDF Summary - ${file?.name ?? "document"}\n\n` +
      `Original words: ${result.originalWordCount}\n` +
      `Summary words: ${result.summaryWordCount}\n` +
      `Sentences: ${result.sentencesPicked} / ${result.totalSentences}\n\n` +
      `--- Key Points ---\n\n${lines}\n\n--- Full Summary ---\n\n${result.summary}\n`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const base = file?.name?.replace(/\.pdf$/i, "") ?? "summary";
    downloadBlob(blob, `${base}-summary.txt`);
  };

  const copySummary = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore — user may be in a context without clipboard access
    }
  };

  const clear = () => {
    setFile(null);
    setResult(null);
    setCopied(false);
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
              <h1>PDF Summary Generator</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !result && (
              <FileUpload
                accept={{ "application/pdf": [".pdf"] }}
                multiple={false}
                onFilesSelected={handleFilesSelected}
              />
            )}

            {file && !result && (
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
                  <ZoomIn className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-500" aria-hidden />
                  Extractive summary — sentences are pulled directly from your PDF in their original order (no rewriting, no invented facts). Exact wording and style are preserved; only the most representative sentences are kept.
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Summary length</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(LENGTH_LABEL) as SummaryLength[]).map((k) => (
                      <Button
                        key={k}
                        type="button"
                        variant={length === k ? "default" : "outline"}
                        onClick={() => setLength(k)}
                        disabled={processing}
                        className="justify-center"
                      >
                        {LENGTH_LABEL[k]}
                      </Button>
                    ))}
                  </div>
                </div>

                {processing && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground/80">
                      {progress >= 90 ? "Almost done…" : "Reading and scoring sentences…"}
                    </p>
                    <Progress value={progress} className="h-2" aria-label="Generating summary" />
                  </div>
                )}

                <div className="flex gap-4 flex-wrap">
                  {processing ? (
                    <Button variant="outline" onClick={cancel}>
                      Cancel
                    </Button>
                  ) : (
                    <>
                      <Button size="lg" onClick={doSummary} disabled={!canSubmit}>
                        <Sparkles className="h-4 w-4" />
                        Generate Summary
                      </Button>
                      <Button variant="outline" onClick={clear}>
                        Clear
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {result && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Original words</p>
                    <p className="text-lg font-semibold">{result.originalWordCount.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Summary words</p>
                    <p className="text-lg font-semibold">{result.summaryWordCount.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Sentences kept</p>
                    <p className="text-lg font-semibold">
                      {result.sentencesPicked} / {result.totalSentences}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Reduced to</p>
                    <p className="text-lg font-semibold">
                      {result.originalWordCount > 0
                        ? Math.round((result.summaryWordCount / result.originalWordCount) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <ListBullet className="h-5 w-5 text-primary" />
                      Key points
                    </h3>
                  </div>
                  <ul className="space-y-2 text-sm text-foreground/90">
                    {result.bulletPoints.map((point, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary font-semibold mt-0.5 shrink-0">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <AlignLeft className="h-5 w-5 text-primary" />
                      Full summary
                    </h3>
                    <Button variant="outline" size="sm" onClick={copySummary}>
                      {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                  <div className="p-4 rounded-lg border bg-background whitespace-pre-wrap text-sm leading-relaxed">
                    {result.summary}
                  </div>
                </div>

                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    <Download className="h-4 w-4" />
                    Download Summary (.txt)
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Summarize Another PDF
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle asChild className="text-xl md:text-2xl">
              <h2>Frequently Asked Questions</h2>
            </CardTitle>
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
