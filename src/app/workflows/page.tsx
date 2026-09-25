import type { Metadata } from "next";
import Link from "next/link";
import { CONVERSION_WORKFLOWS } from "@/lib/content/conversion-workflows";
import { CONVERSION_TOOL_SLUGS } from "@/lib/i18n/conversion-copy";
import { getTool } from "@/lib/tools";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = { title: "PDF conversion workflows: images, Word and PowerPoint | PDFPilot", description: "Choose a practical conversion workflow with supported formats, exact settings and output checks for JPG, DOCX and PPTX files.", alternates: { canonical: "/workflows" } };
export default function WorkflowsPage() {
  return <article className="container mx-auto max-w-5xl space-y-10 px-4 py-12">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "PDF conversion workflows", url: "https://pdfpilot.net/workflows", inLanguage: "en", mainEntity: { "@type": "ItemList", itemListElement: CONVERSION_WORKFLOWS.map((p,i)=>({ "@type": "ListItem", position:i+1, name:p.title, url:`https://pdfpilot.net${p.path}` })) } }} />
    <header><h1 className="text-3xl font-bold">PDF conversion workflows</h1><p className="mt-4 max-w-3xl text-muted-foreground">Choose the result you need, check the supported input and follow the settings. These guides use the same browser-local tools as the main site. They do not promise exact Office rendering or send your documents to a conversion server.</p></header>
    {CONVERSION_TOOL_SLUGS.map(tool=><section key={tool}><h2 className="mb-4 text-2xl font-semibold"><Link href={`/${tool}`} className="underline underline-offset-4">{getTool(`/${tool}`)?.name}</Link></h2><ul className="grid gap-4 sm:grid-cols-2">{CONVERSION_WORKFLOWS.filter(p=>p.tool===tool).map(page=><li key={page.slug} className="rounded-xl border bg-card p-5 text-card-foreground"><Link href={page.path} className="text-lg font-semibold underline underline-offset-4">{page.title}</Link><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{page.description}</p></li>)}</ul></section>)}
  </article>;
}
