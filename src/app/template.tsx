import { headers } from "next/headers";
import type { ReactNode } from "react";
import { ToolTaskLinks } from "@/components/templates/ToolTaskLinks";

/** Per-route template so the server-rendered tool links also update on client navigation. */
export default async function Template({ children }: { children: ReactNode }) {
  const path = (await headers()).get("x-pdfpilot-path") ?? "";
  return <>{children}{/^\/[a-z0-9-]+$/.test(path) && <ToolTaskLinks slug={path.slice(1)} />}</>;
}
