import type { Metadata } from "next";
import { EditPdfClient } from "../edit-pdf/edit-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getToolSeo, getSoftwareApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
const tool=getToolSeo("/sign-pdf")!;
export const metadata:Metadata={title:tool.title,description:tool.description,alternates:{canonical:"/sign-pdf"}};
export default function SignPdfPage(){return <><JsonLd data={[getSoftwareApplicationSchema(tool),getBreadcrumbSchema([{name:"Home",path:"/"},{name:tool.name,path:tool.path}])]}/><EditPdfClient variant="sign" faqs={[]} related={[]}/></>;}
