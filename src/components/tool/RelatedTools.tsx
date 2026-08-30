"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategoryStyle } from "@/lib/category-colors";
import type { Tool } from "@/lib/tools";
import { cn } from "@/lib/utils";

interface RelatedToolsProps {
  title?: string;
  tools: Tool[];
}

export function RelatedTools({
  title = "You may also like",
  tools,
}: RelatedToolsProps) {
  if (tools.length === 0) return null;

  const displayTools = tools.slice(0, 3);

  return (
    <Card className="mt-8 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg md:text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {displayTools.map((tool) => {
            const style = getCategoryStyle(tool);
            const Icon = tool.icon;
            return (
              <Link
                key={tool.path}
                href={tool.path}
                className="flex items-center gap-2.5 py-2.5 px-2 -mx-2 rounded-lg group hover:bg-muted transition-colors"
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
