"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FaqInput } from "@/lib/seo";

/**
 * Collapsed-by-default FAQ presentation for tool pages. Every question's
 * answer is still rendered in the DOM (just visually hidden via CSS, not
 * removed) — the FAQPage JSON-LD in each tool's page.tsx is built server-side
 * straight from the same `faqs` array independent of this component, so
 * collapsing the visual presentation here doesn't touch that schema at all.
 * This exists so the FAQ block stops dominating the page below an already-
 * completed tool workflow, without discarding the SEO content itself.
 */
export function ToolFaqAccordion({ faqs }: { faqs: FaqInput[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (faqs.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">
        Frequently Asked Questions
      </h2>
      <div className="rounded-xl border divide-y bg-white dark:bg-slate-900">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={faq.question}>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium hover:text-primary transition-colors"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                {faq.question}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {isOpen && (
                <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed animate-in fade-in duration-150">
                  {faq.answer}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
