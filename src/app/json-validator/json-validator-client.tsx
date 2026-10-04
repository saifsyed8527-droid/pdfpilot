"use client";

import { JsonToolClient, type JsonToolContent } from "@/app/json-formatter/json-tool-client";

export function JsonValidatorClient(props: JsonToolContent) {
  return <JsonToolClient tool="json-validator" {...props} />;
}
