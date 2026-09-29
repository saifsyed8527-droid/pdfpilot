import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { IntentPage } from "@/components/pseo/IntentPage";
import { intentMetadata } from "@/lib/pseo/metadata";
import { pageSchema } from "@/lib/pseo/schema";
import fixtures from "../../../../tests/fixtures/pseo/pages.json";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
async function getPreview(slug: string) {
  const host = (await headers()).get("host") ?? "";
  if (process.env.PSEO_QA_PREVIEW !== "1" || !/^(?:127\.0\.0\.1|localhost):\d+$/.test(host)) notFound();
  const candidates = JSON.parse(await readFile(join(process.cwd(), "data/pseo/manifests/candidates.json"), "utf8"));
  const raw = candidates.find((p: { slug: string })=>p.slug===slug) ?? fixtures.find(p=>p.slug===slug);
  if (!raw) notFound();
  return pageSchema.parse({ ...raw, indexable: false, canonicalUrl: `https://pdfpilot.net/pseo-preview/${slug}` });
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const page=await getPreview((await params).slug);
  return { ...intentMetadata(page), robots: { index: false, follow: false } };
}
export default async function Preview({ params }: { params: Promise<{ slug: string }> }) {
  return <IntentPage page={await getPreview((await params).slug)} />;
}
