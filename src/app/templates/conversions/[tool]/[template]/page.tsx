import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowRight, Download, ShieldCheck } from "lucide-react";
import { CONVERSION_TEMPLATES, TEMPLATE_ROOT, TEMPLATE_TOOL_NAMES, getConversionTemplate, templatesForTool } from "@/lib/content/conversion-templates";
import { conversionCopy } from "@/lib/i18n/conversion-copy";
import { ConversionTemplateRunner } from "@/components/templates/ConversionTemplateRunner";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo";

type Props = { params: Promise<{ tool: string; template: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return CONVERSION_TEMPLATES.map(row => ({ tool: row.tool, template: row.slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool, template } = await params;
  const row = getConversionTemplate(tool, template);
  if (!row) return {};
  return { title: `${row.title} | PDFPilot`, description: row.description, alternates: { canonical: row.path }, openGraph: { type: "website", title: row.title, description: row.description, url: row.path, locale: "en_US", images: [row.preview] }, twitter: { card: "summary_large_image", title: row.title, description: row.description, images: [row.preview] } };
}
export default async function Page({ params }: Props) {
  const { tool, template } = await params;
  const row = getConversionTemplate(tool, template);
  if (!row) notFound();
  const name = TEMPLATE_TOOL_NAMES[row.tool];
  return <div className="bg-background text-foreground">
    <JsonLd data={[{ "@context": "https://schema.org", "@type": "WebPage", name: row.title, description: row.description, url: `https://pdfpilot.net${row.path}`, inLanguage: "en", image: `https://pdfpilot.net${row.preview}`, mainEntity: { "@type": "SoftwareApplication", name: row.title, applicationCategory: "UtilitiesApplication", operatingSystem: "Web browser", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, url: `https://pdfpilot.net${row.path}#converter` } }, getBreadcrumbSchema([{ name: "PDFPilot", path: "/" }, { name: "Conversion templates", path: TEMPLATE_ROOT }, { name, path: `${TEMPLATE_ROOT}/${row.tool}` }, { name: row.title, path: row.path }])]} />
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap gap-2 text-sm text-muted-foreground"><Link href={TEMPLATE_ROOT} className="underline underline-offset-4">Templates</Link><span aria-hidden>/</span><Link href={`${TEMPLATE_ROOT}/${row.tool}`} className="underline underline-offset-4">{name}</Link></nav>
      <header className="grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Ready-to-use conversion template</p><h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">{row.title}</h1><p className="mt-5 text-lg leading-relaxed text-muted-foreground">{row.description}</p><a href="#converter" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">Use this template <ArrowDown className="h-4 w-4" aria-hidden /></a><p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" aria-hidden />Files stay on your device. No account needed.</p></div>
        <figure className="rounded-2xl border bg-muted/30 p-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- actual local-engine sample output */}
          <img src={row.preview} width={600} height={380} alt={`First PDF page generated from the ${row.title} sample`} className="h-64 w-full object-contain" />
          <figcaption className="mt-3 text-center text-xs text-muted-foreground">Actual sample conversion · first PDF page{row.samples.length > 1 ? " of the first file" : ""}. Try the sample below to inspect the full output.</figcaption>
        </figure>
      </header>
      <section className="my-10 grid gap-4 md:grid-cols-2" aria-label="Input and output"><div className="rounded-xl border bg-card p-5 text-card-foreground"><p className="text-xs font-semibold uppercase text-muted-foreground">1 · Your input</p><p className="mt-2 font-semibold">{row.input}</p></div><div className="rounded-xl border bg-card p-5 text-card-foreground"><p className="text-xs font-semibold uppercase text-muted-foreground">2 · Your result</p><p className="mt-2 font-semibold">{row.output}</p></div></section>
      <section aria-labelledby="template-settings"><h2 id="template-settings" className="text-xl font-semibold">{row.preset ? "Starting settings — editable after choosing files" : "What this template uses"}</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{row.facts.map(([key, value]) => <div key={key} className="rounded-xl border bg-card p-4 text-card-foreground"><dt className="text-xs font-medium text-muted-foreground">{key}</dt><dd className="mt-2 text-sm font-semibold">{value}</dd></div>)}</dl></section>
    </div>
    <section id="converter" className="scroll-mt-24 border-y bg-card/30" aria-label={`Use ${row.title}`}><div className="mx-auto max-w-6xl px-4 pt-8"><h2 className="text-2xl font-semibold">Convert here</h2><p className="mt-2 text-sm text-muted-foreground">Choose your files or try the sample. Review the workspace, then select Convert to PDF.</p></div><ConversionTemplateRunner template={row} /></section>
    <div className="container mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_320px]">
      <div className="space-y-8"><section><h2 className="text-xl font-semibold">Check your PDF</h2><ul className="mt-4 list-disc space-y-3 ps-5">{row.checks.map(check => <li key={check}>{check}</li>)}</ul></section><section className="rounded-xl border bg-muted/30 p-5"><h2 className="font-semibold">Supported conversion, with clear limits</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{conversionCopy("en", row.tool).limitations}</p></section><section><h2 className="text-xl font-semibold">{row.question}</h2><p className="mt-3 leading-relaxed text-muted-foreground">{row.answer}</p></section></div>
      <aside className="space-y-7"><section><h2 className="font-semibold">Download the input samples</h2><p className="mt-2 text-xs text-muted-foreground">Original demonstration files, free to modify. Not customer documents.</p><ul className="mt-3 space-y-2">{row.samples.map(file => <li key={file}><a href={`/template-samples/${file}`} download className="inline-flex items-center gap-2 text-sm underline underline-offset-4"><Download className="h-4 w-4" aria-hidden />{file}</a></li>)}</ul></section><nav aria-label="Related templates"><h2 className="font-semibold">More {name} templates</h2><ul className="mt-3 space-y-3">{templatesForTool(row.tool).filter(other => other.slug !== row.slug).map(other => <li key={other.path}><Link href={other.path} className="text-sm underline underline-offset-4">{other.title}</Link></li>)}</ul></nav><Link href={`/${row.tool}`} className="inline-flex items-center gap-2 text-sm font-semibold">Standard {name} tool <ArrowRight className="h-4 w-4" aria-hidden /></Link></aside>
    </div>
  </div>;
}
