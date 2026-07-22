"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { trackToolConversionCompleted, trackToolConversionFailed } from "@/lib/analytics/events";

type SetProgress = (value: number) => void;
type IsCancelled = () => boolean;

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
 *
 * `cancel()` gives tools a real escape hatch instead of trapping the user
 * for the operation's full duration: it flips `processing` back to false
 * immediately (regardless of what the in-flight task is still doing) and
 * marks the run as cancelled so its eventual success/error toast is
 * suppressed. Tasks that loop over real work (pages, files) should accept
 * the second `isCancelled` argument and check it between iterations so
 * cancelling actually stops doing work, not just hides the UI for it.
 * Tasks that ignore the second argument still get the "stop showing this
 * as in-progress and don't show a stale toast later" behavior for free.
 */
export function useProcessingTask() {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const cancelledRef = useRef(false);

  const run = useCallback(
    async (
      task: (setProgress: SetProgress, isCancelled: IsCancelled) => Promise<void>,
      options: RunOptions
    ) => {
      cancelledRef.current = false;
      setProcessing(true);
      setProgress(0);

      try {
        await task(setProgress, () => cancelledRef.current);
        if (cancelledRef.current) return;
        toast.success(options.successMessage, {
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        });
        trackToolConversionCompleted(options.toolName);
      } catch (error) {
        if (cancelledRef.current) return;
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

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setProcessing(false);
  }, []);

  return { processing, progress, setProgress, run, cancel };
}
