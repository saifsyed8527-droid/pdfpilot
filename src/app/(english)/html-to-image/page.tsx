
import { UiText } from "@/components/i18n/WorkspaceText";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import type { Metadata } from "next";
import { HtmlConvertClient } from "../html-to-pdf/html-to-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import { getToolSeo, getSoftwareApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

const tool = getToolSeo("/html-to-image")!;
export const metadata: Metadata = { title: tool.title, description: tool.description, alternates: { canonical: "/html-to-image", languages: getHreflangLanguagesMap("/html-to-image") },
  openGraph: { type: "website", siteName: "PDFPilot", locale: "en_US", title: tool.title, description: tool.description, url: tool.path, images: ["/og/home.png"] },
  twitter: { card: "summary_large_image", title: tool.title, description: tool.description, images: ["/og/home.png"] } };

export default function HtmlToImagePage() {
  return <><JsonLd data={[getSoftwareApplicationSchema(tool), getBreadcrumbSchema([{ name: "Home", path: "/" }, { name: tool.name, path: tool.path }])]} /><HtmlConvertClient mode="image" />
    <section className="mx-auto w-full max-w-4xl px-5 py-8 text-sm leading-6 text-slate-600 dark:text-slate-300" aria-label="HTML to Image help">
      <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">{""}<UiText text={"Save HTML as an image"} />{""}</h2>
      <p>{""}<UiText text={"Add a public URL or an HTML file, review the preview at desktop, tablet or mobile width, and choose PNG, JPG, WEBP or SVG. Capture the full page or its first screen. Adjust image resolution, compressed-image quality, ad blocking and popup removal before downloading."} />{""}</p>
      <p className="mt-3">{""}<UiText text={"Local HTML is rendered in your browser. URLs and external assets use the website’s public fetch service. Signed-in pages, imported scripts, embedded frames and live video are not supported. Some CSS effects and fonts can look different; review the preview and saved image. SVG uses HTML inside a foreignObject and is intended for modern browsers, not every vector editor."} />{""}</p>
    </section></>;
}
