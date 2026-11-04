import { NextResponse, type NextRequest } from "next/server";
import { getLocaleBySegment } from "@/lib/i18n/locales";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/task-examples/")) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex");
    return response;
  }
  const segment = request.nextUrl.pathname.split("/").filter(Boolean)[0] ?? "";
  const locale = getLocaleBySegment(segment);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pdfpilot-path", request.nextUrl.pathname);
  requestHeaders.set("x-pdfpilot-locale", locale?.code ?? "en");

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Language", locale?.code ?? "en");
  return response;
}

export const config = {
  matcher: ["/task-examples/:path*", "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
