import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TEMPLATE_ROOT, TEMPLATE_TOOLS, TEMPLATE_TOOL_NAMES } from "@/lib/content/conversion-templates";
import { TemplateCollection } from "@/components/templates/TemplateCollection";
type Props = { params: Promise<{ tool: keyof typeof TEMPLATE_TOOL_NAMES }> };
export const dynamicParams = false;
export function generateStaticParams() { return TEMPLATE_TOOLS.map(tool => ({ tool })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool } = await params;
  if (!TEMPLATE_TOOLS.includes(tool)) return {};
  const title = `${TEMPLATE_TOOL_NAMES[tool]} templates — preview and convert`;
  const description = `Browse usable ${TEMPLATE_TOOL_NAMES[tool]} templates, try sample files and convert your own documents in your browser.`;
  return { title: `${title} | PDFPilot`, description, alternates: { canonical: `${TEMPLATE_ROOT}/${tool}` }, openGraph: { type: "website", title, description, url: `${TEMPLATE_ROOT}/${tool}` }, twitter: { card: "summary_large_image", title, description } };
}
export default async function Page({ params }: Props) {
  const { tool } = await params;
  if (!TEMPLATE_TOOLS.includes(tool)) notFound();
  return <TemplateCollection tool={tool} />;
}
