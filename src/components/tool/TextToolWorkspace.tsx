"use client";

import { useId, type ReactNode } from "react";
import { PdfWorkspaceBar } from "@/components/tool/PdfToolChrome";
import { ToolRelatedContent } from "@/components/content/ToolRelatedContent";
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
  faqs = [],
  related = [],
}: {
  title: string;
  description: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  faqs?: FaqInput[];
  related?: ResolvedEntity[];
}) {
  return (
    <div className="flex flex-1 flex-col bg-slate-50/70 dark:bg-slate-950/40">
      <PdfWorkspaceBar title={title} meta={meta} actions={actions} />
      <div className="container mx-auto w-full min-w-0 max-w-[1500px] px-4 py-6 md:py-8">
        <p className="mb-6 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
          {description}
        </p>
        <div className="min-w-0 space-y-6">{children}</div>
        {faqs.length > 0 && (
          <div className="mx-auto mt-10 max-w-4xl">
            <TextToolPanel title="Frequently Asked Questions">
              <div className="space-y-6">
                {faqs.map((faq) => (
                  <div key={faq.question}>
                    <h3 className="mb-1 font-semibold">{faq.question}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </TextToolPanel>
          </div>
        )}
        {related.length > 0 && <ToolRelatedContent items={related} />}
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
  return (
    <section aria-labelledby={headingId} className={cn("min-w-0 rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-900 md:p-6", className)}>
      <h2 id={headingId} className="text-lg font-bold tracking-tight md:text-xl">{title}</h2>
      {description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>}
      <div className="mt-5 min-w-0">{children}</div>
    </section>
  );
}
