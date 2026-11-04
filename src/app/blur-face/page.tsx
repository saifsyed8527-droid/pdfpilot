import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { BlurFaceClient } from "./blur-face-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getToolSeo, getSoftwareApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
const tool = getToolSeo("/blur-face")!;
export const metadata: Metadata = { title: tool.title, description: tool.description, alternates: { canonical: "/blur-face", languages: getHreflangLanguagesMap("/blur-face") },
  openGraph: { type: "website", siteName: "PDFPilot", locale: "en_US", title: tool.title, description: tool.description, url: tool.path, images: ["/og/home.png"] },
  twitter: { card: "summary_large_image", title: tool.title, description: tool.description, images: ["/og/home.png"] } };
export default function BlurFacePage() { return <><JsonLd data={[getSoftwareApplicationSchema(tool), getBreadcrumbSchema([{ name: "Home", path: "/" }, { name: tool.name, path: tool.path }])]} /><BlurFaceClient /></>; }
