import type { Metadata } from "next";
import { JwtDecodeClient } from "./jwt-decode-client";
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

const tool = getToolSeo("/jwt-decode")!;
const toolEntity = getTool("/jwt-decode")!;
const relatedContent = getContentReferencingTool(toolEntity.id);
const relatedTools = resolveEntities(
  toolEntity.relatedTools.map((id) => ({ type: "tool" as const, id }))
);
const existingPaths = new Set([...relatedTools, ...relatedContent].map((e) => e.path));
const clusterMembers = getClusterMembers(toolEntity.id).filter((member) => !existingPaths.has(member.path));

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/jwt-decode" },
  openGraph: {
    type: "website",
    siteName: "PDFPilot",
    locale: "en_US",
    title: tool.title,
    description: tool.description,
    url: "/jwt-decode",
    images: [{ url: "/og/jwt-decode.png", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: tool.title,
    description: tool.description,
    images: ["/og/jwt-decode.png"],
  },
};

const faqs: FaqInput[] = [
  {
    question: "Is decoding JWTs with PDFPilot really free?",
    answer: "Yes. JWT Decoder is completely free to use, with no sign-up or account required.",
  },
  {
    question: "Are my tokens uploaded to a server?",
    answer: "No. Decoding runs entirely in your browser. Your token is never uploaded to PDFPilot's servers.",
  },
  {
    question: "Does this verify the token's signature?",
    answer:
      "No. This tool decodes the header and payload only. Verifying a signature requires the issuer's real secret or public key, which this tool never has — treat this as a way to inspect a token's claims, not to confirm it's genuine.",
  },
  {
    question: "What format does the token need to be in?",
    answer:
      "A standard JWT: three dot-separated Base64URL-encoded parts (header.payload.signature). Upload a .txt file containing the token text.",
  },
];

export default function JwtDecodePage() {
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
      <JwtDecodeClient faqs={faqs} related={[...relatedTools, ...relatedContent, ...clusterMembers]} />
    </>
  );
}
