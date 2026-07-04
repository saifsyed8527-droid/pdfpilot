import { ORGANIZATION_ID, SITE_URL, WEBSITE_ID } from "./constants";
import type { SchemaReference } from "./types";

export interface SoftwareApplicationSchema {
  "@context": "https://schema.org";
  "@type": "SoftwareApplication";
  "@id": string;
  name: string;
  url: string;
  description?: string;
  publisher: SchemaReference;
  isPartOf: SchemaReference;
}

export interface SoftwareApplicationInput {
  /** Human-readable tool name, e.g. "Merge PDF" */
  name: string;
  /** Route path starting with "/", e.g. "/merge-pdf" */
  path: string;
  description?: string;
}

export function getSoftwareApplicationSchema({
  name,
  path,
  description,
}: SoftwareApplicationInput): SoftwareApplicationSchema {
  const url = `${SITE_URL}${path}`;

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${url}#software`,
    name,
    url,
    ...(description ? { description } : {}),
    publisher: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
  };
}
