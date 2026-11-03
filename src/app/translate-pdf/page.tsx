import type { Metadata } from "next";
import { TranslatePdfClient } from "./translate-pdf-client";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getToolSeo,
  getSoftwareApplicationSchema,
  getBreadcrumbSchema,
} from "@/lib/seo";
const tool = getToolSeo("/translate-pdf")!;
export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: "/translate-pdf" },
};
export default function TranslatePdfPage() {
  return (
    <>
      <JsonLd
        data={[
          getSoftwareApplicationSchema(tool),
          getBreadcrumbSchema([
            { name: "Home", path: "/" },
            { name: tool.name, path: tool.path },
          ]),
        ]}
      />
      <TranslatePdfClient />
    </>
  );
}
