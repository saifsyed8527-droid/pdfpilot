"use client";

import { EncodingToolClient, type EncodingToolContent } from "@/app/base64-encode/encoding-tool-client";

export function UrlEncodeClient(props: EncodingToolContent) {
  return <EncodingToolClient tool="url-encode" {...props} />;
}
