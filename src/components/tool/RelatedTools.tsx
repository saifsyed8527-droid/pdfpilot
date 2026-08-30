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
      <CardHeader className="pb-4">
        <CardTitle className="text-lg md:text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayTools.map((tool) => {
            const style = getCategoryStyle(tool);
            const Icon = tool.icon;
            return (
              <Link
                key={tool.path}
                href={tool.path}
                className="block group"
              >
                <div
                  className={cn(
                    "h-full p-4 rounded-xl border transition-all duration-200",
                    "group-hover:border-primary/40 group-hover:shadow-md group-hover:-translate-y-0.5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        style.bgClass
                      )}
                    >
                      <Icon
                        className={cn("h-5 w-5", style.iconClass)}
                        aria-hidden
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium group-hover:text-primary transition-colors truncate">
                        {tool.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {tool.tagline}
                      </p>
                    </div>
                    <ArrowRight
                      className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0"
                      aria-hidden
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
