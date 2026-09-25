"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategoryStyle } from "@/lib/category-colors";
import type { Tool } from "@/lib/tools";
import { isLaunchTool } from "@/lib/launch-catalog";
import { cn } from "@/lib/utils";

interface RelatedToolsProps {
  title?: string;
  tools: Tool[];
}

export function RelatedTools({
  title = "You may also like",
  tools,
}: RelatedToolsProps) {
  const displayTools = tools.filter((tool) => isLaunchTool(tool.slug)).slice(0, 3);
  if (displayTools.length === 0) return null;

  return (
    <Card className="mt-8 bg-card text-card-foreground">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg md:text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {displayTools.map((tool) => {
            const style = getCategoryStyle(tool);
            const Icon = tool.icon;
            return (
              <Link
                key={tool.path}
                href={tool.path}
                className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2.5 text-card-foreground group hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon
                  className={cn("h-4 w-4 shrink-0", style.iconClass)}
                  aria-hidden
                />
                <span className="flex-1 min-w-0 text-sm font-medium group-hover:text-primary transition-colors truncate">
                  {tool.name}
                </span>
                <ArrowRight
                  className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0"
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
