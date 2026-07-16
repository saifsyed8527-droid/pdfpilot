import type { Metadata } from "next";
import { ExcelSheetMergerClient } from "./excel-sheet-merger-client";
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

const tool = getToolSeo("/excel-sheet-merger")!;
const toolEntity = getTool("/excel-sheet-merger")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/excel-sheet-merger" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/excel-sheet-merger",
    images: [{ url: "/og/excel-sheet-merger.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/excel-sheet-merger.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is merging Excel files with PDFPilot really free?",
    answer: "Yes. Excel Sheet Merger is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The merging runs entirely in your browser using a real spreadsheet library. Your files are never uploaded to PDFPilot's servers.",
  },
  {
    question: "How are the sheets named in the merged workbook?",
    answer: "After each source file's name (stripped of its extension and any characters Excel doesn't allow in a sheet name). If two files would produce the same sheet name, a number is appended to keep them distinct.",
  },
  {
    question: "Does this merge every sheet from each file, or just one?",
    answer: "Just the first sheet from each uploaded file — if a source file has multiple sheets, only its first one is included. Use Excel Sheet Extractor first if you need a specific sheet from a multi-sheet file.",
  },
  {
    question: "Is the output a real multi-sheet Excel workbook?",
    answer: "Yes — a genuine .xlsx file with each source file as its own separate sheet, all in one workbook you can open and switch between with the sheet tabs.",
  },
];

export default function ExcelSheetMergerPage() {
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
      <ExcelSheetMergerClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
