"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface DownloadButtonProps {
  onClick: () => void;
  size?: "default" | "sm" | "lg" | "icon";
  children?: ReactNode;
}

export function DownloadButton({
  onClick,
  size = "lg",
  children = "Download",
}: DownloadButtonProps) {
  return (
    <Button size={size} onClick={onClick}>
      <Download className="h-4 w-4" />
      {children}
    </Button>
  );
}
