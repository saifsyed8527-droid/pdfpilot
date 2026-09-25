import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CONVERSION_WORKFLOWS, getConversionWorkflow, getConversionWorkflows } from "@/lib/content/conversion-workflows";
import { getTool } from "@/lib/tools";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() { return CONVERSION_WORKFLOWS.map(p=>({slug:p.slug})); }
type Props = {params: Promise<{slug:string}>};
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const page=getConversionWorkflow((await params).slug);
  if(!page) return {};
  return { title:`${page.title} | PDFPilot`, description:page.description, alternates:{canonical:page.path}, robots:{index:true,follow:true}, openGraph:{type:"article",title:page.title,description:page.description,url:page.path,locale:"en_US",images:[`/og/${page.tool}.png`]} };
}
export default async function WorkflowPage({params}:Props) {
  const page=getConversionWorkflow((await params).slug);
  if(!page) notFound();
  const tool=getTool(`/${page.tool}`)!;
  return <article className="container mx-auto max-w-4xl space-y-8 px-4 py-12">
    <JsonLd data={[{"@context":"https://schema.org","@type":"TechArticle",headline:page.title,description:page.description,url:`https://pdfpilot.net${page.path}`,inLanguage:"en",dateModified:page.reviewedAt,author:{"@type":"Organization",name:"PDFPilot",url:"https://pdfpilot.net"},mainEntityOfPage:`https://pdfpilot.net${page.path}`},getBreadcrumbSchema([{name:"PDFPilot",path:"/"},{name:"Conversion workflows",path:"/workflows"},{name:page.title,path:page.path}])]} />
    <Link href="/workflows" className="text-sm underline underline-offset-4">All conversion workflows</Link>
    <header><h1 className="text-3xl font-bold leading-tight">{page.title}</h1><p className="mt-4 text-lg text-muted-foreground">{page.description}</p><p className="mt-4 leading-relaxed">{page.intro}</p></header>
    <Link href={tool.path} className="inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Open {tool.name}</Link>
    <section><h2 className="text-2xl font-semibold">Settings and supported output</h2><dl className="mt-4 divide-y rounded-xl border bg-card text-card-foreground">{page.settings.map(([label,value])=><div key={label} className="grid gap-2 p-4 sm:grid-cols-[1fr_2fr]"><dt className="font-medium">{label}</dt><dd className="text-muted-foreground">{value}</dd></div>)}</dl></section>
    <section><h2 className="text-2xl font-semibold">Follow this workflow</h2><ol className="mt-4 list-decimal space-y-4 ps-6">{page.steps.map(step=><li key={step} className="ps-2 leading-relaxed">{step}</li>)}</ol></section>
    <section><h2 className="text-2xl font-semibold">Check the downloaded result</h2><ul className="mt-4 list-disc space-y-3 ps-6">{page.checks.map(check=><li key={check}>{check}</li>)}</ul></section>
    <section className="rounded-xl border bg-muted/40 p-5"><h2 className="text-xl font-semibold">When to use another export method</h2><p className="mt-3 leading-relaxed">{page.limitation}</p></section>
    <section><h2 className="text-xl font-semibold">{page.question}</h2><p className="mt-3 leading-relaxed">{page.answer}</p></section>
    <nav aria-label="Related workflows"><h2 className="text-xl font-semibold">Related workflows</h2><ul className="mt-4 space-y-3">{getConversionWorkflows(page.tool).filter(p=>p.slug!==page.slug).map(p=><li key={p.slug}><Link href={p.path} className="underline underline-offset-4">{p.title}</Link></li>)}</ul></nav>
    <p className="border-t pt-4 text-sm text-muted-foreground">Product behavior reviewed {page.reviewedAt}. These instructions describe supported behavior, not a guarantee for every file. Files stay on your device.</p>
  </article>;
}
