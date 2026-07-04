import { ORGANIZATION_ID, SITE_NAME, SITE_URL } from "./constants";

export interface OrganizationSchema {
  "@context": "https://schema.org";
  "@type": "Organization";
  "@id": string;
  name: string;
  url: string;
}

export function getOrganizationSchema(): OrganizationSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_URL,
  };
}
