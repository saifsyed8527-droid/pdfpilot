"use client";

import { EncodingToolClient, type EncodingToolContent } from "@/app/base64-encode/encoding-tool-client";

export function Base64DecodeClient(props: EncodingToolContent) {
  return <EncodingToolClient tool="base64-decode" {...props} />;
}
