import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";

const BASE_URL = "https://pdfpilot.net";

// Pages that aren't part of the Tool model (home + static utility pages).
const NON_TOOL_PAGES = ["/about", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", ...TOOLS.map((tool) => tool.path), ...NON_TOOL_PAGES];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));
}
