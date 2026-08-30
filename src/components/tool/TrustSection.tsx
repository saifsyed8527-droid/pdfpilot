"use client";

import { ShieldCheck, Zap, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function TrustSection() {
  const items = [
    {
      icon: ShieldCheck,
      text: "Files never leave your device",
    },
    {
      icon: Zap,
      text: "No uploads required",
    },
    {
      icon: Lock,
      text: "No account needed",
    },
  ];

  return (
    <Card className="mt-8 bg-muted/40 border-muted">
      <CardContent className="py-5">
        <ul className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4 sm:gap-8">
          {items.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4 text-foreground/70" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
