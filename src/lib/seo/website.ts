import { ORGANIZATION_ID, SITE_NAME, SITE_URL, WEBSITE_ID } from "./constants";
import type { SchemaReference } from "./types";

export interface WebSiteSchema {
  "@context": "https://schema.org";
  "@type": "WebSite";
  "@id": string;
  name: string;
  url: string;
  publisher: SchemaReference;
}

export function getWebSiteSchema(): WebSiteSchema {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { "@id": ORGANIZATION_ID },
  };
}
