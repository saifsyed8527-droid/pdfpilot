"use client";

import { ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { parseLocalizedPath } from "@/lib/i18n/url-strategy";
import { SITE_PRIVACY } from "@/lib/i18n/site-privacy";
import { Card, CardContent } from "@/components/ui/card";

export function TrustSection() {
  const { locale } = parseLocalizedPath(usePathname());

  return (
    <Card className="mt-8 bg-muted/40 border-muted">
      <CardContent className="py-5">
        <p className="flex items-start justify-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-foreground/70" aria-hidden />
          <span>{SITE_PRIVACY[locale]}</span>
        </p>
      </CardContent>
    </Card>
  );
}
