"use client";

import { useEffect } from "react";
import { trackContentOpened } from "@/lib/analytics/events";

interface TrackContentOpenedProps {
  contentType: string;
  contentId: string;
}

/** Fires `content_opened` once per real page visit — a tiny client
 *  island so `EntityPageLayout` (and the server-rendered pages that use
 *  it) don't have to become client components just for this one
 *  side effect. */
export function TrackContentOpened({ contentType, contentId }: TrackContentOpenedProps) {
  useEffect(() => {
    trackContentOpened(contentType, contentId);
  }, [contentType, contentId]);

  return null;
}
