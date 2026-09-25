import { notFound, permanentRedirect } from "next/navigation";
import { CONVERSION_TEMPLATES } from "@/lib/content/conversion-templates";
// Preserve published links, not the rejected article layout.
const destinations: Record<string,string> = {
  ...Object.fromEntries(CONVERSION_TEMPLATES.filter(row=>row.legacy).map(row=>[row.legacy!,row.path])),
  "pptx-fonts-to-pdf": "/templates/conversions/powerpoint-to-pdf/standard-slides",
  "pptx-charts-smartart-to-pdf": "/powerpoint-to-pdf#conversion-details",
};
export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(destinations).map(slug=>({slug})); }
export default async function Page({params}:{params:Promise<{slug:string}>}) {
  const destination=destinations[(await params).slug];
  if(!destination) notFound();
  permanentRedirect(destination);
}
