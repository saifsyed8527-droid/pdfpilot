"use client";
import { useWorkspaceText } from "@/components/i18n/WorkspaceText";

import { FileType } from "lucide-react";
import { OfficeToPdfWorkspace } from "@/components/tool/OfficeToPdfWorkspace";
import type { TemplateSession } from "@/lib/content/conversion-templates";
import { convertWordToPdf } from "@/lib/engines/word-pdf-engine";
import { officeArchiveInputError } from "@/lib/engines/conversion-input-errors";
const DOCX = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
};
export function WordToPdfClient({
  templateSession,
}: { templateSession?: TemplateSession } = {}) {
  const __copy = useWorkspaceText();
  return (
    <OfficeToPdfWorkspace
      templateSession={templateSession}
      title={__copy("Word to PDF")}
      description={__copy("Turn DOCX documents into clean, shareable PDFs. Add one file or a batch and review the result before sharing.")}
      buttonLabel={__copy("Select Word files")}
      dropLabel={__copy("or drag and drop DOCX files here")}
      accepted={DOCX}
      extension="DOCX"
      icon={FileType}
      accent="amber"
      canRotate
      convertsRotation
      toolName="word-to-pdf"
      addButtonPosition="top"
      convert={async (
        file,
        progress,
        cancelled,
        _sheets,
        rotation = 0,
        preview = false,
      ) => {
        const pagePreviews: string[] = [];
        try {
          const blob = await convertWordToPdf(file, {
            rotation,
            isCancelled: cancelled,
            onProgress: progress,
            onPagePreview: preview
              ? (image) => pagePreviews.push(image)
              : undefined,
          });
          return { blob, pagePreviews: preview ? pagePreviews : undefined };
        } catch (error) {
          const message = officeArchiveInputError(error, "DOCX");
          if (message) throw new Error(message);
          throw error;
        }
      }}
      fidelityNote="Preserves supported images, tables and visual formatting as image-based PDF pages. Text is not selectable or searchable. Fonts can be substituted; inspect page breaks and visual output. Unsupported objects fail clearly."
    />
  );
}
