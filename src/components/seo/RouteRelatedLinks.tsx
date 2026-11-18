import type { ReactNode } from "react";
import { ToolTaskLinks } from "@/components/templates/ToolTaskLinks";
import { ToolConnectionLinks } from "@/components/connections/ToolConnectionLinks";
import { parseLocalizedPath } from "@/lib/i18n/url-strategy";

/** Per-route template so the server-rendered tool links also update on client navigation. */
export default function RouteRelatedLinks({ children, path }: { children: ReactNode; path: string }) {
  const parsed = parseLocalizedPath(path);
  return <>{children}{parsed.toolPath && <ToolConnectionLinks slug={parsed.toolPath.slice(1)} locale={parsed.locale} />}{parsed.toolPath && <ToolTaskLinks slug={parsed.toolPath.slice(1)} locale={parsed.locale} />}</>;
}
