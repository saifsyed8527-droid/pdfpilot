import { connectionSitemapXml } from "@/lib/connections/sitemap";
export async function GET(_request: Request, { params }: { params: Promise<{ language: string; page: string }> }) {
  const { language, page } = await params;
  const xml = connectionSitemapXml(language, page);
  return xml ? new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } }) : new Response("Not found", { status: 404 });
}
