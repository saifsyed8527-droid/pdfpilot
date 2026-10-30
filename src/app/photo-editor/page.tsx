import type { Metadata } from "next";
import { PhotoEditorClient } from "./photo-editor-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getToolSeo, getSoftwareApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
const tool = getToolSeo("/photo-editor")!;
export const metadata: Metadata = { title: tool.title, description: tool.description, alternates: { canonical: "/photo-editor" } };
export default function PhotoEditorPage() { return <><JsonLd data={[getSoftwareApplicationSchema(tool), getBreadcrumbSchema([{ name: "Home", path: "/" }, { name: tool.name, path: tool.path }])]} /><PhotoEditorClient /></>; }
