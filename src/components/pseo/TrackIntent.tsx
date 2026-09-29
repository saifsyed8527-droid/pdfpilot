"use client";
import { useEffect } from "react";
import { trackIntentOpened } from "@/lib/analytics/events";
export function TrackIntent(props: { pageId: string; baseTool: string; intentType: string; intentCluster: string; sourceMarkets: string[] }) {
  const { pageId, baseTool, intentType, intentCluster, sourceMarkets } = props;
  const markets = sourceMarkets.join(",");
  useEffect(() => { trackIntentOpened({ page_type: "pseo", page_id: pageId, base_tool: baseTool, intent_type: intentType, intent_cluster: intentCluster, source_market: markets }); }, [pageId, baseTool, intentType, intentCluster, markets]);
  return null;
}
