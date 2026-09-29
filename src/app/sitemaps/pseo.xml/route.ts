import { pseoSitemapIndex } from "@/lib/pseo/sitemap";
export function GET() {
  return new Response(pseoSitemapIndex(), { headers: { "Content-Type": "application/xml; charset=utf-8", "X-Robots-Tag": "noindex" } });
}
