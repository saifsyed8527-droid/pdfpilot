"use client";

import { JsonToolClient, type JsonToolContent } from "@/app/json-formatter/json-tool-client";

export function JsonMinifierClient(props: JsonToolContent) {
  return <JsonToolClient tool="json-minifier" {...props} />;
}
