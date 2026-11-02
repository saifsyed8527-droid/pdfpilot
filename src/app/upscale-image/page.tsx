import type { Metadata } from "next";
import { UpscaleImageClient } from "./upscale-image-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getToolSeo, getSoftwareApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
const tool = getToolSeo("/upscale-image")!;
export const metadata: Metadata = { title: tool.title, description: tool.description, alternates: { canonical: "/upscale-image" } };
export default function UpscaleImagePage() { return <><JsonLd data={[getSoftwareApplicationSchema(tool), getBreadcrumbSchema([{ name: "Home", path: "/" }, { name: tool.name, path: tool.path }])]} /><UpscaleImageClient /></>; }
