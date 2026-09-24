import { NextResponse, type NextRequest } from "next/server";
import { getLocaleBySegment } from "@/lib/i18n/locales";
import { isLaunchTool } from "@/lib/launch-catalog";
import toolsData from "@/lib/tools-data.json";

const archivedSlugs = new Set(toolsData.filter((tool) => !isLaunchTool(tool.slug)).map((tool) => tool.slug));

export function middleware(request: NextRequest) {
  const segment = request.nextUrl.pathname.split("/").filter(Boolean)[0] ?? "";
  const locale = getLocaleBySegment(segment);
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  const toolSlug = locale ? parts[1] : parts[0];
  // Unlisted tools are temporarily off the public launch, not deleted.
  if (archivedSlugs.has(toolSlug)) {
    const response = NextResponse.rewrite(new URL("/tool-unavailable", request.url), { status: 404 });
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pdfpilot-locale", locale?.code ?? "en");

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Language", locale?.code ?? "en");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
