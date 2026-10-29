"use client";
import { PdfTextToolClient } from "@/components/tool/PdfTextToolClient";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
export function SummaryGeneratorClient(props:{faqs:FaqInput[];related:ResolvedEntity[]}){return <PdfTextToolClient mode="summary" {...props}/>;}
