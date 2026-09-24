"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { isLaunchTool } from "@/lib/launch-catalog";
import { localizedPath, parseLocalizedPath } from "@/lib/i18n/url-strategy";

/** Localize application navigation, never filenames, external URLs or document content. */
export function LocaleLink({ href, ...props }: ComponentProps<typeof Link>) {
  const { locale } = parseLocalizedPath(usePathname());
  let destination = href;
  if (typeof href === "string") {
    const [path] = href.split(/[?#]/);
    if (path === "/" || isLaunchTool(path.slice(1))) {
      destination = localizedPath(path, locale) + href.slice(path.length);
    }
  }
  return <Link {...props} href={destination} />;
}
