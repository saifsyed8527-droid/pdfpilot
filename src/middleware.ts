import { NextResponse, type NextRequest } from "next/server";
import { getLocaleBySegment } from "@/lib/i18n/locales";
import { isLaunchTool, isLocalizedLaunchTool } from "@/lib/launch-catalog";

export function middleware(request: NextRequest) {
  const segment = request.nextUrl.pathname.split("/").filter(Boolean)[0] ?? "";
  const locale = getLocaleBySegment(segment);
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  const toolSlug = locale ? parts[1] : parts[0];
  // A language-prefixed link to an English tool still reaches the working tool.
  if (parts.length === 2 && locale && isLaunchTool(toolSlug) && !isLocalizedLaunchTool(toolSlug)) {
    const destination = request.nextUrl.clone();
    destination.pathname = `/${toolSlug}`;
    return NextResponse.redirect(destination, 307);
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
