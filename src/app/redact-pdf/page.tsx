import type { Metadata } from "next";
import { RedactPdfClient } from "./redact-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getToolSeo, getSoftwareApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

const tool = getToolSeo("/redact-pdf")!;
export const metadata: Metadata = { title: tool.title, description: tool.description, alternates: { canonical: "/redact-pdf" } };
export default function RedactPdfPage() {
  return <><JsonLd data={[getSoftwareApplicationSchema(tool), getBreadcrumbSchema([{ name: "Home", path: "/" }, { name: tool.name, path: tool.path }])]} /><RedactPdfClient /></>;
}
