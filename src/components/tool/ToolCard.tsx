"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { getCategoryStyle } from "@/lib/category-colors";
import type { Tool } from "@/lib/tools";
import { cn } from "@/lib/utils";

export function ToolCard({ tool }: { tool: Tool }) {
  const style = getCategoryStyle(tool);
  const Icon = tool.icon;

  return (
    <Link href={tool.path} className="block group">
      <Card
        className={cn(
          "h-full bg-white border transition-all duration-200",
          "group-hover:border-primary/40 group-hover:shadow-tool-card-hover group-hover:-translate-y-0.5",
          "shadow-tool-card"
        )}
      >
        <CardContent className="pt-6">
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors",
              style.bgClass
            )}
          >
            <Icon className={cn("h-6 w-6", style.iconClass)} aria-hidden />
          </div>
          <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
            {tool.name}
          </h3>
          <p className="text-sm text-muted-foreground">{tool.tagline}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
