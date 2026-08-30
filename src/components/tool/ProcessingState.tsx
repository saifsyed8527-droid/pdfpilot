"use client";

import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface ProcessingStateProps {
  progress: number;
  label?: string;
  cancelable?: boolean;
  onCancel?: () => void;
}

export function ProcessingState({
  progress,
  label = "Processing…",
  cancelable = true,
  onCancel,
}: ProcessingStateProps) {
  return (
    <div className="rounded-lg border bg-muted/30 p-6 space-y-4">
      <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
        <div className="space-y-1">
          <p role="status" className="font-medium text-foreground">
            {label}
          </p>
          <p className="text-sm text-muted-foreground">
            {Math.round(progress)}% complete
          </p>
        </div>
      </div>
      <Progress value={progress} className="h-2" />
      {cancelable && onCancel && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
