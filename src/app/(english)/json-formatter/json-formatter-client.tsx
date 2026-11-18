"use client";

import { JsonToolClient, type JsonToolContent } from "@/app/json-formatter/json-tool-client";

export function JsonFormatterClient(props: JsonToolContent) {
  return <JsonToolClient tool="json-formatter" {...props} />;
}
