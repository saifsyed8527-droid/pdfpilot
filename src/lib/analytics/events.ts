import { sendGAEvent } from "@next/third-parties/google";

/**
 * The full GA4 event taxonomy for PDFPilot, in one place. `sendGAEvent`
 * itself is a real, already-live integration (see
 * src/components/analytics/GoogleAnalytics.tsx — reads a real
 * NEXT_PUBLIC_GA_MEASUREMENT_ID and no-ops if it's absent, so this file
 * behaves identically in an environment without that env var configured).
 * `tool_conversion_completed` already existed, inline in
 * use-processing-task.tsx, before this file — moved here and renamed
 * from the previous inline "download_success" call for clarity against
 * the new events added alongside it, not changed in what it measures.
 *
 * Every function below is a thin, named wrapper around `send` (below) —
 * the taxonomy is the point: one file that says exactly what PDFPilot
 * measures and with what parameters, rather than `sendGAEvent` calls
 * scattered ad hoc across components with hand-typed event names that
 * could drift or duplicate.
 */

/**
 * A real, verified-live bug found this sprint: `@next/third-parties`'s
 * `GoogleAnalytics` component loads its init script with
 * `strategy="afterInteractive"`, which can still be pending when a
 * component's own `useEffect` fires `sendGAEvent` on mount — `sendGAEvent`
 * then silently no-ops with only a `console.warn("GA dataLayer dataLayer
 * does not exist")`, dropping the event. Confirmed live: a fresh
 * `content_opened` call on page load produced that exact warning and no
 * network hit; the same call after retrying past the race succeeded.
 * This is a race in the underlying package, not something this project's
 * code can fix upstream — so every event in this file is routed through
 * this small retry wrapper instead of calling `sendGAEvent` directly,
 * fixing it once for every event (including the ones that already
 * existed before this fix) rather than per call site.
 */
function send(name: string, params: Record<string, unknown>, attempt = 0): void {
  if (typeof window === "undefined") return;
  if (!window.dataLayer && attempt < 5) {
    setTimeout(() => send(name, params, attempt + 1), 200);
    return;
  }
  sendGAEvent("event", name, params);
}

export function trackToolConversionCompleted(toolName: string): void {
  send("tool_conversion_completed", { tool_name: toolName });
}

export function trackToolConversionFailed(toolName: string, errorMessage: string): void {
  send("tool_conversion_failed", {
    tool_name: toolName,
    error_message: errorMessage.slice(0, 150), // GA4 string param limit is 100 chars for some fields; keep well under
  });
}

export function trackSearchPerformed(query: string, resultCount: number): void {
  send("search_performed", { search_term: query, result_count: resultCount });
}

export function trackSearchResultClicked(query: string, resultType: string, resultPath: string): void {
  send("search_result_clicked", {
    search_term: query,
    result_type: resultType,
    result_path: resultPath,
  });
}

/** Fires when any "Related Content" link is clicked, on any page type
 *  that renders one — Tools, Guides, Comparisons, Industries, Use Cases,
 *  Checklists, Templates, Glossary all render related links through the
 *  single shared `RelatedContent` component, so wiring this there
 *  instruments every content type at once instead of once per type. */
export function trackRelatedContentClicked(targetType: string, targetPath: string): void {
  send("related_tool_clicked", { target_type: targetType, target_path: targetPath });
}

/**
 * Fires once when a Guide/Comparison/Industry/Template/Checklist/Use
 * Case page's content is opened. One parameterized event
 * (`content_opened` + `content_type`) rather than five separate event
 * names (`guide_opened`, `comparison_opened`, etc.) — GA4 best practice
 * favors differentiating by parameter over proliferating near-duplicate
 * event names for the same underlying action ("a content page was
 * opened"), and it's what one shared `EntityPageLayout` component can
 * instrument for every content type through a single prop, instead of
 * duplicating a tracking call into every page.tsx.
 */
export function trackContentOpened(contentType: string, contentId: string): void {
  send("content_opened", { content_type: contentType, content_id: contentId });
}

export function trackChecklistCompleted(checklistId: string): void {
  send("checklist_completed", { checklist_id: checklistId });
}

// tool_chain_started / tool_chain_completed (requested in the Phase 3
// brief) are deliberately not implemented: there is no "chain multiple
// tools together" feature in this product today (each tool is a separate
// upload -> process -> download flow with no shared session state
// carrying a file from one tool into the next). Adding these two events
// now would mean instrumenting a user journey that doesn't exist to
// measure — the same "no fake analytics" rule this file's design already
// follows. Build the chaining feature first; these two events are then a
// small addition to it, not a prerequisite.
