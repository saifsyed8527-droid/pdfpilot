"use client";

import { ImageEditTools } from "@/components/tool/ImageEditTools";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";

export function ResizeImageClient(props: { faqs: FaqInput[]; related: ResolvedEntity[] }) {
  return <ImageEditTools mode="resize" {...props} />;
}
