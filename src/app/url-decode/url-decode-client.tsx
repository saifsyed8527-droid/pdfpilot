"use client";

import { EncodingToolClient, type EncodingToolContent } from "@/app/base64-encode/encoding-tool-client";

export function UrlDecodeClient(props: EncodingToolContent) {
  return <EncodingToolClient tool="url-decode" {...props} />;
}
