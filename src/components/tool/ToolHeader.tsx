"use client";

import { getCategoryStyle } from "@/lib/category-colors";
import type { Tool } from "@/lib/tools";
import { cn } from "@/lib/utils";

export function ToolHeader({ tool }: { tool: Tool }) {
  const style = getCategoryStyle(tool);
  const Icon = tool.icon;

  return (
    <div className="flex items-center gap-5">
      <div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
          style.bgClass
        )}
      >
        <Icon className={cn("h-7 w-7", style.iconClass)} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {tool.name}
        </h1>
        <p className="text-muted-foreground mt-1">{tool.tagline}</p>
      </div>
    </div>
  );
}
