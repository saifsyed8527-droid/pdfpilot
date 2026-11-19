import type { ReactNode } from "react";

/** Preserve the route boundary without injecting retired editorial links. */
export default function RouteRelatedLinks({ children }: { children: ReactNode; path: string }) {
  return <>{children}</>;
}
