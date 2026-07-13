"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { trackToolConversionCompleted, trackToolConversionFailed } from "@/lib/analytics/events";

type SetProgress = (value: number) => void;

interface RunOptions {
  successMessage: string;
  errorTitle: string;
  /**
   * Stable tool identifier (matches Tool.slug, e.g. "merge-pdf") used as the
   * GA4 conversion event's parameter — the one place every tool's "did a
   * user actually finish and get a result" moment is reported.
   */
  toolName: string;
  /**
   * Called on failure before the error toast is shown. Use it to log the
   * error (each tool logs a different label) and optionally return a
   * description string for the toast — a fixed string, or one derived from
   * the caught error itself.
   */
  onError?: (error: unknown) => string | undefined;
}

/**
 * Shared processing/progress/toast flow used by every PDF tool page:
 * set processing + reset progress, run the tool-specific work, show a
 * success or error toast, and always clear processing when done.
 */
export function useProcessingTask() {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const run = useCallback(
    async (task: (setProgress: SetProgress) => Promise<void>, options: RunOptions) => {
      setProcessing(true);
      setProgress(0);

      try {
        await task(setProgress);
        toast.success(options.successMessage, {
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        });
        trackToolConversionCompleted(options.toolName);
      } catch (error) {
        const description = options.onError?.(error);
        toast.error(options.errorTitle, {
          description,
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        });
        trackToolConversionFailed(options.toolName, description ?? "Unknown error");
      } finally {
        setProcessing(false);
      }
    },
    []
  );

  return { processing, progress, setProgress, run };
}
