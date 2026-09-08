"use client";

import { Presentation } from "lucide-react";
import { OfficeToPdfWorkspace } from "@/components/tool/OfficeToPdfWorkspace";
import { convertPptxToPdf } from "@/lib/engines/pptx-engine";

const PPTX = { "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"] };
// Reused while this tab stays open: each batch shares raw font bytes, so
// converting several presentations does not fetch the same font files again.
const fontByteCache = new Map<string, Uint8Array>();

export function PowerpointToPdfClient() {
  return <OfficeToPdfWorkspace
    title="PowerPoint to PDF"
    description="Turn PPTX presentations into PDFs while keeping each slide’s real layout intact."
    buttonLabel="Select PowerPoint files"
    dropLabel="or drop PowerPoint files here"
    accepted={PPTX}
    extension="PPTX"
    icon={Presentation}
    accent="orange"
    canRotate
    toolName="powerpoint-to-pdf"
    convert={(file, progress, cancelled) => convertPptxToPdf(file, progress, cancelled, fontByteCache)}
    fidelityNote="Slide size, master backgrounds, layout placeholders, text, colours, fills, tables and supported images are preserved. Complex charts and unsupported Office vector formats may use a simplified fallback."
  />;
}
