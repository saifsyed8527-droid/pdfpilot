"use client";
import { ImageConvertRotateTools } from "@/components/tool/ImageConvertRotateTools";
import type { FaqInput } from "@/lib/seo";
import type { ResolvedEntity } from "@/lib/content/registry";
export function RotateImageClient(props: { faqs: FaqInput[]; related: ResolvedEntity[] }) { return <ImageConvertRotateTools mode="rotate" {...props} />; }
