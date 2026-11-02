"use client";
import { PdfPasswordWorkspace } from "@/components/tool/PdfPasswordWorkspace";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
export function UnlockPdfClient({
  faqs,
  related,
}: {
  faqs: FaqInput[];
  related: ResolvedEntity[];
}) {
  return (
    <PdfPasswordWorkspace operation="unlock" faqs={faqs} related={related} />
  );
}
