"use client";
import { useWorkspaceText } from "@/components/i18n/WorkspaceText";


import { useToolCopy } from "@/components/i18n/UiText";
import { useId, type ReactNode } from "react";
import { PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import type { ResolvedEntity } from "@/lib/content/registry";
import type { FaqInput } from "@/lib/seo";
import { cn } from "@/lib/utils";

/** Shared visual shell; each utility owns its editors, settings and processing. */
export function TextToolWorkspace({
  title,
  description,
  meta,
  actions,
  children,
}: {
  title: string;
  description: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  faqs?: FaqInput[];
  related?: ResolvedEntity[];
}) {
  const __copy = useWorkspaceText();
  const copy = useToolCopy();
  return (
    <div className="flex flex-1 flex-col bg-slate-50/70 dark:bg-slate-950/40">
      <PdfWorkspaceBar title={title} meta={meta} actions={actions} />
      <div className="container mx-auto w-full min-w-0 max-w-[1500px] px-4 py-6 md:py-8">
        <p className="mb-6 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
          {copy.locale === "en" ? description : copy.description(typeof description === "string" ? description : "")}
        </p>
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}

export function TextToolPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  const t = useWorkspaceText();
  return (
    <section aria-labelledby={headingId} className={cn("min-w-0 rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-900 md:p-6", className)}>
      <h2 id={headingId} className="text-lg font-bold tracking-tight md:text-xl">{t(title)}</h2>
      {description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{typeof description === "string" ? t(description) : description}</p>}
      <div className="mt-5 min-w-0">{children}</div>
    </section>
  );
}
