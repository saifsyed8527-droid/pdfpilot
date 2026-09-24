import type { Metadata } from "next";
import { EditPdfClient } from "./edit-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getBreadcrumbSchema,
  getFaqSchema,
  getSoftwareApplicationSchema,
  getToolSeo,
  type FaqInput,
} from "@/lib/seo";
import { getTool } from "@/lib/tools";
import { getContentReferencingTool } from "@/lib/content/tool-related";
import { resolveEntities } from "@/lib/content/registry";
import { getClusterMembers } from "@/lib/content/topic-clusters";

const tool = getToolSeo("/edit-pdf")!;
const toolEntity = getTool("/edit-pdf")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/edit-pdf",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/edit-pdf",
    images: [{ url: "/og/edit-pdf.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/edit-pdf.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is Edit PDF really free?",
    answer:
      "Yes. Edit PDF is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. The entire editor runs in your browser — pages are rendered and everything you add is drawn in locally. Your file is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What can I add to my PDF with this tool?",
    answer:
      "A full toolset: text (with bold, italic, underline, strikethrough, color, alignment, and an optional clickable link), rectangles, ellipses, lines, a highlighter, freehand drawing, sticky notes, images, clickable links, and real fillable form fields (text, checkbox, radio, dropdown). You can also draw, type, or upload a signature, add named bookmarks that appear in the PDF's outline, and attach supporting files inside the document. Every object can be moved, resized, and rotated with on-canvas handles, reordered front-to-back, and duplicated. This is different from Fill PDF, which only fills in fields that already exist in a fillable form — Edit PDF lets you add new content, and even build new form fields, on any regular document.",
  },
  {
    question: "Does it have undo, keyboard shortcuts, and zoom?",
    answer:
      "Yes. Ctrl/Cmd+Z to undo and Ctrl/Cmd+Shift+Z to redo, Ctrl/Cmd+C/V to copy and paste, Ctrl/Cmd+D to duplicate, Delete to remove the selection, arrow keys to nudge it (hold Shift for bigger steps), and Escape to deselect. Zoom in or out from the floating toolbar to work on fine details or see a full page at once.",
  },
  {
    question: "Can I edit rotated pages?",
    answer:
      "Not in this version. If a page has been rotated (for example with our Rotate PDF tool), editing that specific page is disabled to avoid placing content incorrectly — other, unrotated pages in the same file can still be edited normally.",
  },
  {
    question: "How does the signature tool work?",
    answer:
      "Click Signature to open a dialog with three ways to sign: draw it with your mouse, trackpad, or touchscreen, type your name in a signature-style font, or upload an image of your signature. Whichever you choose is placed on the page as a normal object you can move, resize, or delete before saving.",
  },
  {
    question: "Are the form fields and bookmarks real, or just visual?",
    answer:
      "They're real. Form fields (text, checkbox, radio, dropdown) are saved as genuine fillable AcroForm fields that work in any PDF reader, and bookmarks are saved into the PDF's outline/table of contents — both are part of the saved file, not something that only shows inside PDFPilot.",
  },
  {
    question: "Can I work on multiple pages, with lots of objects?",
    answer:
      "Yes. Add as many objects as you need, on as many pages as you need, before saving — each keeps its own position, size, rotation, and style. The page thumbnails on the right show which pages have edits.",
  },
  {
    question: "Do I need to install any software to edit a PDF?",
    answer:
      "No installation is required. Edit PDF runs directly in your web browser.",
  },
];

export default function EditPdfPage() {
  return (
    <>
      {tool && (
        <JsonLd
          data={[
            getSoftwareApplicationSchema(tool),
            getBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: tool.name, path: tool.path },
            ]),
            getFaqSchema(faqs),
          ]}
        />
      )}
      <ToolWorkspace />
    </>
  );
}

/** Shared by the English route and every localized route; only copy may differ. */
export function ToolWorkspace() {
  return <EditPdfClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />;
}
