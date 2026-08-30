"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StartOverButtonProps {
  onClick: () => void;
  size?: "default" | "sm" | "lg" | "icon";
}

export function StartOverButton({
  onClick,
  size = "lg",
}: StartOverButtonProps) {
  return (
    <Button variant="outline" size={size} onClick={onClick}>
      <RefreshCw className="h-4 w-4" />
      Start Over
    </Button>
  );
}
