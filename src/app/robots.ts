import { PSEO_PAGES } from "@/lib/pseo/registry";
import type { MetadataRoute } from "next";

const BASE_URL = "https://pdfpilot.net";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: PSEO_PAGES.length ? [`${BASE_URL}/sitemap.xml`, `${BASE_URL}/sitemaps/pseo.xml`] : `${BASE_URL}/sitemap.xml`,
  };
}
