import { GoogleAnalytics } from "./GoogleAnalytics";
import { Clarity } from "./Clarity";

export { GoogleAnalytics };
export { Clarity };

/**
 * Single mount point for all tracking providers.
 * Add new providers here (e.g. Meta Pixel, Google Ads,
 * LinkedIn Insight, TikTok Pixel) — the root layout never needs to change.
 */
export function Analytics() {
  return (
    <>
      <GoogleAnalytics />
      <Clarity />
    </>
  );
}
