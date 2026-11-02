"use client";
import { StructuredDataWorkspace } from "@/components/tool/StructuredDataWorkspace";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
export function XmlToCsvClient(props: {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}) {
  return <StructuredDataWorkspace mode="xml-to-csv" faqs={props.faqs} />;
}
