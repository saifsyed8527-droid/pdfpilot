"use client";

import { FileToolLayout } from "@/components/tool/FileToolLayout";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, FileCode } from "lucide-react";
import type { FaqInput } from "@/lib/seo";
import { validateXml, type ValidationResult } from "@/lib/engines/format-engine";
import { trackToolConversionCompleted, trackToolConversionFailed } from "@/lib/analytics/events";
import type { ResolvedEntity } from "@/lib/content/registry";

interface XmlValidatorClientProps {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}

export function XmlValidatorClient({ faqs, related }: XmlValidatorClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [checking, setChecking] = useState(false);

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setResult(null);
    }
  };

  const check = async () => {
    if (!file) return;
    setChecking(true);
    try {
      const text = await file.text();
      const validation = validateXml(text);
      setResult(validation);
      if (validation.valid) {
        trackToolConversionCompleted("xml-validator");
      } else {
        trackToolConversionFailed("xml-validator", validation.error ?? "Invalid XML");
      }
    } finally {
      setChecking(false);
    }
  };

  const clear = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <FileToolLayout toolSlug="xml-validator" files={[file]}
      accept={{ "application/xml": [".xml"] }} multiple={false} onFilesSelected={handleFilesSelected}
      result={result} processing={checking} onReset={clear} faqs={faqs} related={related}>

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

                <div className="flex gap-4 flex-wrap">
                  <Button size="lg" onClick={check} disabled={checking}>
                    Validate XML
                  </Button>
                  <Button variant="outline" onClick={clear} disabled={checking}>
                    Clear
                  </Button>
                </div>
              </>
            )}

            {result && (
              <div className="text-center space-y-4">
                {result.valid ? (
                  <>
                    <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-xl font-semibold">This XML is valid!</h3>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                      <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-xl font-semibold">This XML is not valid</h3>
                    <p className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-lg text-left whitespace-pre-wrap">
                      {result.error}
                    </p>
                  </>
                )}
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button variant="outline" onClick={clear}>
                    Check Another File
                  </Button>
                </div>
              </div>
            )}

    </FileToolLayout>
  );
}
