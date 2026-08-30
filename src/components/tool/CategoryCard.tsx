"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface CategoryCardProps {
  title: string;
  description: string;
  toolCount: number;
  icon: LucideIcon;
  path: string;
  iconBgClass?: string;
  iconClass?: string;
}

export function CategoryCard({
  title,
  description,
  toolCount,
  icon: Icon,
  path,
  iconBgClass = "bg-primary/10",
  iconClass = "text-primary",
}: CategoryCardProps) {
  return (
    <Link href={path} className="block group">
      <Card
        className={cn(
          "h-full bg-white border transition-all duration-200",
          "group-hover:border-primary/40 group-hover:shadow-md group-hover:-translate-y-0.5",
          "shadow-tool-card"
        )}
      >
        <CardContent className="pt-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <div
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center transition-colors group-hover:opacity-90",
                iconBgClass
              )}
            >
              <Icon className={cn("h-5 w-5", iconClass)} aria-hidden />
            </div>
            {toolCount > 0 && (
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  {toolCount} tool{toolCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
          <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 flex-1">{description}</p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            Browse
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
