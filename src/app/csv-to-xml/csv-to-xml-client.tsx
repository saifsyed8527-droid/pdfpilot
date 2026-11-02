"use client";
import { StructuredDataWorkspace } from "@/components/tool/StructuredDataWorkspace";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
export function CsvToXmlClient(props: {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}) {
  return <StructuredDataWorkspace mode="csv-to-xml" faqs={props.faqs} />;
}
