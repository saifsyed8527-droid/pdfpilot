import type { MetadataRoute } from "next";

const BASE_URL = "https://pdfpilot.net";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/merge-pdf",
    "/split-pdf",
    "/compress-pdf",
    "/pdf-to-jpg",
    "/jpg-to-pdf",
    "/about",
    "/privacy",
    "/terms",
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));
}
