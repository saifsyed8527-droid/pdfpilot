"use client";

import { Presentation } from "lucide-react";
import { OfficeToPdfWorkspace } from "@/components/tool/OfficeToPdfWorkspace";
import { renderPptxToPdf } from "@/lib/engines/pptx-renderer";

const PPTX = { "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"] };
// Reused while this tab stays open: each batch shares raw font bytes, so
// converting several presentations does not fetch the same font files again.
const fontByteCache = new Map<string, Uint8Array>();

export function PowerpointToPdfClient() {
  return <OfficeToPdfWorkspace
    title="PowerPoint to PDF"
    description="Convert PPTX slides to PDF, including drawings, images and text. Your files stay on your device."
    buttonLabel="Select PowerPoint files"
    dropLabel="or drop PowerPoint files here"
    accepted={PPTX}
    extension="PPTX"
    icon={Presentation}
    accent="orange"
    canRotate
    toolName="powerpoint-to-pdf"
    convert={(file, progress, cancelled) => renderPptxToPdf(file, progress, cancelled, fontByteCache)}
    fidelityNote="Keeps slide dimensions, vector drawings, embedded pictures and text. Fonts may be substituted. Charts, SmartArt and other unsupported content will show an error instead of being removed. For exact PowerPoint appearance, use PowerPoint’s PDF export."
  />;
}
