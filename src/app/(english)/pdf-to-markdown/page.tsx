import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { PdfTextToolClient } from "@/components/tool/PdfTextToolClient";
import { JsonLd } from "@/components/seo/JsonLd";
import { getToolSeo, getSoftwareApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
const tool=getToolSeo("/pdf-to-markdown")!;
export const metadata:Metadata={title:tool.title,description:tool.description,alternates:{canonical:"/pdf-to-markdown", languages: getHreflangLanguagesMap("/pdf-to-markdown")},
  openGraph: { type: "website", siteName: "PDFPilot", locale: "en_US", title: tool.title, description: tool.description, url: tool.path, images: ["/og/home.png"] },
  twitter: { card: "summary_large_image", title: tool.title, description: tool.description, images: ["/og/home.png"] }};

export default function PdfToMarkdownPage(){return <><JsonLd data={[getSoftwareApplicationSchema(tool),getBreadcrumbSchema([{name:"Home",path:"/"},{name:tool.name,path:tool.path}]),]}/><PdfTextToolClient mode="markdown" faqs={[]}/></>;}
