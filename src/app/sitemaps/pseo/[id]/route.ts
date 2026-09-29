import { pseoSitemapXml } from "@/lib/pseo/sitemap";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const xml = pseoSitemapXml((await params).id);
  return new Response(xml ?? "Not found", { status: xml ? 200 : 404, headers: { "Content-Type": xml ? "application/xml; charset=utf-8" : "text/plain", "X-Robots-Tag": "noindex" } });
}
