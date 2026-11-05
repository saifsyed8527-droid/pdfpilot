"use client";
import { useState, type ReactNode } from "react";
import { IntentPresentation } from "@/components/pseo/IntentPresentation";
import { SITE_PRIVACY } from "@/lib/i18n/site-privacy";
import type { LocaleCode } from "@/lib/i18n/locales";
import copy from "@/lib/connections/copy.json";

export function ConnectedTool({ name, description, locale, children }: { name: string; description: string; locale: LocaleCode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <section className="overflow-hidden rounded-2xl border bg-card">
    <div className="p-5"><button aria-expanded={open} onClick={() => setOpen(true)} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">{copy[locale].openTool.replace("{tool}", name)}</button></div>
    {open && <IntentPresentation title={name} description={description} privacy={SITE_PRIVACY[locale]}>{children}</IntentPresentation>}
  </section>;
}
