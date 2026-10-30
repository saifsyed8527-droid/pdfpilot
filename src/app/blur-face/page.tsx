import type { Metadata } from "next";
import { BlurFaceClient } from "./blur-face-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getToolSeo, getSoftwareApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
const tool = getToolSeo("/blur-face")!;
export const metadata: Metadata = { title: tool.title, description: tool.description, alternates: { canonical: "/blur-face" } };
export default function BlurFacePage() { return <><JsonLd data={[getSoftwareApplicationSchema(tool), getBreadcrumbSchema([{ name: "Home", path: "/" }, { name: tool.name, path: tool.path }])]} /><BlurFaceClient /></>; }
