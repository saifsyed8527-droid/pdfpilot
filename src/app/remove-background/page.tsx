import type { Metadata } from "next";
import { RemoveBackgroundClient } from "./remove-background-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getToolSeo, getSoftwareApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
const tool = getToolSeo("/remove-background")!;
export const metadata: Metadata = { title: tool.title, description: tool.description, alternates: { canonical: "/remove-background" } };
export default function RemoveBackgroundPage() { return <><JsonLd data={[getSoftwareApplicationSchema(tool), getBreadcrumbSchema([{ name: "Home", path: "/" }, { name: tool.name, path: tool.path }])]} /><RemoveBackgroundClient /></>; }
