import type { Metadata } from "next";
import { PhotoEditorClient } from "../photo-editor/photo-editor-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getToolSeo, getSoftwareApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
const tool = getToolSeo("/meme-generator")!;
export const metadata: Metadata = { title: tool.title, description: tool.description, alternates: { canonical: "/meme-generator" } };
export default function MemeGeneratorPage() { return <><JsonLd data={[getSoftwareApplicationSchema(tool), getBreadcrumbSchema([{ name: "Home", path: "/" }, { name: tool.name, path: tool.path }])]} /><PhotoEditorClient variant="meme" /></>; }
