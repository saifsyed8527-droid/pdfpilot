import type { Metadata } from "next";
import { ImageMetadataClient } from "./image-metadata-client";
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

const tool = getToolSeo("/image-metadata")!;
const toolEntity = getTool("/image-metadata")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: {
    canonical: "/image-metadata",
  },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/image-metadata",
    images: [{ url: "/og/image-metadata.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/image-metadata.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is viewing or removing image metadata with PDFPilot really free?",
    answer: "Yes. Image Metadata is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer:
      "No. Metadata is read and removed entirely in your browser. Your image is never uploaded to PDFPilot's servers.",
  },
  {
    question: "What metadata does this show?",
    answer:
      "EXIF data your camera or phone may have embedded — camera make and model, the date the photo was taken, GPS coordinates if location was recorded, and the software used to create or edit it.",
  },
  {
    question: "Why doesn't my image show any metadata?",
    answer:
      "Many images genuinely don't carry EXIF data — most PNGs, most screenshots, and many images that have already passed through a web upload or social media platform have had it stripped already.",
  },
  {
    question: "What happens when I remove metadata?",
    answer:
      "The image is decoded and re-encoded from scratch, which discards all EXIF data as a side effect — useful before sharing a photo publicly if you don't want to reveal where or when it was taken.",
  },
];

export default function ImageMetadataPage() {
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
      <ImageMetadataClient faqs={faqs} related={[...relatedTools, ...relatedContent]} />
    </>
  );
}
