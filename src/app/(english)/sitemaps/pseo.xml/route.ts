/** Standalone editorial sitemaps were retired; crawlers should drop this index. */
export function GET() {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain", "X-Robots-Tag": "noindex" } });
}
