"use client";
import { useWorkspaceText } from "@/components/i18n/WorkspaceText";


import { Presentation } from "lucide-react";
import { OfficeToPdfWorkspace } from "@/components/tool/OfficeToPdfWorkspace";
import { renderPptxToPdf } from "@/lib/engines/pptx-renderer";
import { officeArchiveInputError } from "@/lib/engines/conversion-input-errors";

const PPTX = { "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"] };
// Reused while this tab stays open: each batch shares raw font bytes, so
// converting several presentations does not fetch the same font files again.
const fontByteCache = new Map<string, Uint8Array>();

export function PowerpointToPdfClient({ templateSession }: { templateSession?: import("@/lib/content/conversion-templates").TemplateSession } = {}) {
  const __copy = useWorkspaceText();
  return <OfficeToPdfWorkspace
    templateSession={templateSession}
    title={__copy("PowerPoint to PDF")}
    description={__copy("Convert PPTX slides to PDF, including drawings, images and text. Your files stay on your device.")}
    buttonLabel={__copy("Select PowerPoint files")}
    dropLabel={__copy("or drop PowerPoint files here")}
    accepted={PPTX}
    extension="PPTX"
    icon={Presentation}
    accent="orange"
    canRotate
    toolName="powerpoint-to-pdf"
    convert={async (file, progress, cancelled) => {
      try {
        return await renderPptxToPdf(file, progress, cancelled, fontByteCache);
      } catch (error) {
        const readableMessage = officeArchiveInputError(error, "PPTX");
        if (readableMessage) throw new Error(readableMessage);
        throw error;
      }
    }}
    fidelityNote="Keeps slide dimensions, vector drawings, embedded pictures and text. Fonts may be substituted. Charts, SmartArt and other unsupported content will show an error instead of being removed. For exact PowerPoint appearance, use PowerPoint’s PDF export."
  />;
}
