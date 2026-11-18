import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { EditPdfClient } from "../edit-pdf/edit-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getToolSeo, getSoftwareApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
const tool=getToolSeo("/sign-pdf")!;
export const metadata:Metadata={title:tool.title,description:tool.description,alternates:{canonical:"/sign-pdf", languages: getHreflangLanguagesMap("/sign-pdf")},
  openGraph: { type: "website", siteName: "PDFPilot", locale: "en_US", title: tool.title, description: tool.description, url: tool.path, images: ["/og/home.png"] },
  twitter: { card: "summary_large_image", title: tool.title, description: tool.description, images: ["/og/home.png"] }};
export default function SignPdfPage(){return <><JsonLd data={[getSoftwareApplicationSchema(tool),getBreadcrumbSchema([{name:"Home",path:"/"},{name:tool.name,path:tool.path}])]}/><EditPdfClient variant="sign" faqs={[]} related={[]}/></>;}
