import { SITE_URL } from "./constants";

export interface HowToStep {
  name: string;
  text: string;
  url?: string;
}

export interface HowToSchema {
  "@context": "https://schema.org";
  "@type": "HowTo";
  name: string;
  description: string;
  url: string;
  step: { "@type": "HowToStep"; position: number; name: string; text: string; url?: string }[];
}

export interface HowToInput {
  name: string;
  description: string;
  path: string;
  steps: HowToStep[];
}

/**
 * The correct schema.org type for "an ordered sequence of real steps to
 * accomplish a task" — Use Case pages (and the new Workflow-style entries
 * added to that same content type in Phase 3) are exactly this shape, and
 * were previously schema'd as a generic CollectionPage, which describes
 * "a list of things" rather than "a procedure." HowTo is what Google's own
 * structured-data guidance recommends for step-by-step content and can
 * produce a richer search result, unlike CollectionPage. Not used for
 * Comparison/Category/Industry pages — those genuinely are curated lists,
 * not procedures, so CollectionPage stays correct for them.
 */
export function getHowToSchema({ name, description, path, steps }: HowToInput): HowToSchema {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    url: `${SITE_URL}${path}`,
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.url ? { url: `${SITE_URL}${step.url}` } : {}),
    })),
  };
}
