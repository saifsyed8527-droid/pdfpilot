import { GoogleAnalytics } from "./GoogleAnalytics";

export { GoogleAnalytics };

/**
 * Single mount point for all tracking providers.
 * Add new providers here (e.g. Clarity, Meta Pixel, Google Ads,
 * LinkedIn Insight, TikTok Pixel) — the root layout never needs to change.
 */
export function Analytics() {
  return (
    <>
      <GoogleAnalytics />
    </>
  );
}
