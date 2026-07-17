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
import { decodeJwt, type DecodedJwt } from "@/lib/engines/encoding-engine";
import type { ResolvedEntity } from "@/lib/content/registry";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";

interface JwtDecodeClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function JwtDecodeClient({ faqs, related }: JwtDecodeClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DecodedJwt | null>(null);
  const { processing, run } = useProcessingTask();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResult(null);
    }
  };

  const decode = () => {
    if (!file) return;

    run(
      async () => {
        setResult(null);
        const token = await file.text();
        const decoded = decodeJwt(token);
        setResult(decoded);
      },
      {
        successMessage: "Decoded successfully!",
        toolName: "jwt-decode",
        errorTitle: "Failed to decode this token",
        onError: (error) => (error instanceof Error ? error.message : "Please try again"),
      }
    );
  };

  const downloadResult = () => {
    if (!result) return;
    const combined = JSON.stringify({ header: result.header, payload: result.payload }, null, 2);
    downloadBlob(new Blob([combined], { type: "application/json" }), "decoded-jwt.json");
  };

  const clear = () => {
    setFile(null);
    setResult(null);
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
              <h1>JWT Decoder</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file && !result && (
              <FileUpload
                accept={{ "text/plain": [".txt"] }}
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

                <p className="text-sm text-muted-foreground">
                  Upload a .txt file containing a JWT (a token with three dot-separated parts).
                  This decodes the header and payload only — it does not verify the signature,
                  since that requires the issuer&apos;s secret or public key, which this tool never has.
                </p>

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={decode} disabled={processing}>
                    Decode Token
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={processing}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {result && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Decoded successfully!</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Header</p>
                    <pre className="p-4 bg-muted rounded-lg text-xs leading-relaxed overflow-x-auto max-h-80 overflow-y-auto">
                      {JSON.stringify(result.header, null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Payload</p>
                    <pre className="p-4 bg-muted rounded-lg text-xs leading-relaxed overflow-x-auto max-h-80 overflow-y-auto">
                      {JSON.stringify(result.payload, null, 2)}
                    </pre>
                  </div>
                </div>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button size="lg" onClick={downloadResult}>
                    <Download className="h-4 w-4 mr-2" />
                    Download as JSON
                  </Button>
                  <Button variant="outline" onClick={clear}>
                    Decode Another Token
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
