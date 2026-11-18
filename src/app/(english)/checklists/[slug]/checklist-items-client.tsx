"use client";

import { useState } from "react";
import Link from "next/link";
import { trackChecklistCompleted } from "@/lib/analytics/events";
import type { ChecklistItem } from "@/lib/content/checklists";
import type { ResolvedEntity } from "@/lib/content/registry";

interface ChecklistItemsProps {
  checklistId: string;
  items: ChecklistItem[];
  resolvedTools: (ResolvedEntity | undefined)[];
}

/** Real, working checkboxes — a checklist a user can't check off items on
 *  is a checklist in name only. Fires `checklist_completed` once, the
 *  first time every item gets checked in a session (not on every toggle
 *  after that), the same "meaningful event, not noise" standard as every
 *  other event in this project. */
export function ChecklistItems({ checklistId, items, resolvedTools }: ChecklistItemsProps) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
  const [hasFiredCompletion, setHasFiredCompletion] = useState(false);

  const toggle = (index: number) => {
    const next = [...checked];
    next[index] = !next[index];
    setChecked(next);

    if (next.every(Boolean) && !hasFiredCompletion) {
      trackChecklistCompleted(checklistId);
      setHasFiredCompletion(true);
    }
  };

  return (
    <ul className="space-y-3">
      {items.map((item, index) => {
        const tool = resolvedTools[index];
        return (
          <li key={index} className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={checked[index]}
              onChange={() => toggle(index)}
              aria-label={`Mark done: ${item.text}`}
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
            />
            <span className={checked[index] ? "text-muted-foreground line-through" : "text-muted-foreground"}>
              {item.text}
              {tool && (
                <>
                  {" "}
                  <Link href={tool.path} className="underline underline-offset-4 hover:text-foreground">
                    Open {tool.title}
                  </Link>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
