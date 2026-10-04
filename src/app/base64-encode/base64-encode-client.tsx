"use client";

import { EncodingToolClient, type EncodingToolContent } from "@/app/base64-encode/encoding-tool-client";

export function Base64EncodeClient(props: EncodingToolContent) {
  return <EncodingToolClient tool="base64-encode" {...props} />;
}
