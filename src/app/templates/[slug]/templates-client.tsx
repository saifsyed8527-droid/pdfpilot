"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";
import { downloadBlob } from "@/lib/download-file";
import { generateTemplate, type TemplateGeneratorId } from "@/lib/engines/template-engine";
import { useProcessingTask } from "@/lib/use-processing-task";

interface TemplateDownloadCardProps {
  generatorId: TemplateGeneratorId;
  downloadFileName: string;
  toolName: string;
}

/** Every other tool's "upload -> process -> download" flow with no
 *  upload step — a template has nothing to upload, only something to
 *  generate. Reuses useProcessingTask for the same progress/toast/error
 *  handling every tool already has, rather than a one-off pattern. */
export function TemplateDownloadCard({ generatorId, downloadFileName, toolName }: TemplateDownloadCardProps) {
  const { processing, run } = useProcessingTask();

  const handleDownload = () => {
    run(
      async () => {
        const blob = await generateTemplate(generatorId);
        downloadBlob(blob, downloadFileName);
      },
      {
        successMessage: "Template downloaded!",
        toolName,
        errorTitle: "Failed to generate template",
        onError: () => "Please try again.",
      }
    );
  };

  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <Download className="h-8 w-8 text-primary" aria-hidden />
        </div>
        <Button size="lg" onClick={handleDownload} disabled={processing}>
          {processing ? "Generating…" : "Download Template"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Generated in your browser when you click — nothing is uploaded or downloaded from a server.
        </p>
      </CardContent>
    </Card>
  );
}
