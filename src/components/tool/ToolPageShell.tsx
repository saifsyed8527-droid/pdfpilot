"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ToolHeader } from "./ToolHeader";
import type { Tool } from "@/lib/tools";
import type { ReactNode } from "react";

interface ToolPageShellProps {
  tool: Tool;
  children: ReactNode;
}

export function ToolPageShell({ tool, children }: ToolPageShellProps) {
  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link
          href="/"
          className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card className="bg-white">
          <CardHeader>
            <ToolHeader tool={tool} />
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
