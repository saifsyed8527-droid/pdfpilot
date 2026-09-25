import type { Metadata } from "next";
import { TemplateCollection } from "@/components/templates/TemplateCollection";
const title = "PDF conversion templates — choose, preview and use";
const description = "Choose ready-to-use JPG, Word and PowerPoint conversion templates. Preview sample results and convert files privately on each template page.";
export const metadata: Metadata = { title: `${title} | PDFPilot`, description, alternates: { canonical: "/templates/conversions" }, openGraph: { type: "website", title, description, url: "/templates/conversions" }, twitter: { card: "summary_large_image", title, description } };
export default function Page() { return <TemplateCollection />; }
