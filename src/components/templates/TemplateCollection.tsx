import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";
import { CONVERSION_TEMPLATES, TEMPLATE_ROOT, TEMPLATE_TOOL_NAMES, templatesForTool } from "@/lib/content/conversion-templates";
import { TemplateGallery } from "./TemplateGallery";

export function TemplateCollection({ tool }: { tool?: keyof typeof TEMPLATE_TOOL_NAMES }) {
  const templates = tool ? templatesForTool(tool) : CONVERSION_TEMPLATES;
  const title = tool ? `${TEMPLATE_TOOL_NAMES[tool]} templates` : "Start with the PDF you need";
  const path = tool ? `${TEMPLATE_ROOT}/${tool}` : TEMPLATE_ROOT;
  return <div className="container mx-auto max-w-7xl px-4 py-10 md:py-14">
    <JsonLd data={[{ "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: `https://pdfpilot.net${path}`, inLanguage: "en", mainEntity: { "@type": "ItemList", itemListElement: templates.map((row, i) => ({ "@type": "ListItem", position: i + 1, name: row.title, url: `https://pdfpilot.net${row.path}` })) } }, getBreadcrumbSchema([{ name: "PDFPilot", path: "/" }, { name: "Conversion templates", path: TEMPLATE_ROOT }, ...(tool ? [{ name: TEMPLATE_TOOL_NAMES[tool], path }] : [])])]} />
    <header className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-widest text-primary">PDFPilot · conversion templates</p><h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{title}</h1><p className="mt-5 text-lg leading-relaxed text-muted-foreground">Choose a result, inspect a real sample, then convert your own files on the template page. Image templates start with ready-to-use settings; Word and PowerPoint templates use your document’s own page or slide layout.</p><p className="mt-4 text-sm text-muted-foreground">Free · browser-only processing · no sign-up</p>{tool && <Link href={`/${tool}`} className="mt-5 inline-block text-sm underline underline-offset-4">Open the standard {TEMPLATE_TOOL_NAMES[tool]} tool</Link>}</header>
    <TemplateGallery templates={templates} tool={tool} />
    <nav aria-label="More ways to create a PDF" className="mt-10 flex flex-wrap gap-5 text-sm"><Link href="/templates" className="underline">Create a PDF from an editable document template</Link><Link href="/pdf-workflows" className="underline">Combine PDF tasks in one workflow</Link></nav>
  </div>;
}
