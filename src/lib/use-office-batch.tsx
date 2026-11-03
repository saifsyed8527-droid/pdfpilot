"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  trackToolConversionCompleted,
  trackToolConversionFailed,
} from "./analytics/events";
import {
  officeItemKey,
  runOfficeBatch,
  packageOfficePdfs,
  type OfficeBatchItem,
  type OfficeBatchOutput,
  type OfficeConvertedDocument,
} from "./engines/office-batch";

type Result = NonNullable<Awaited<ReturnType<typeof packageOfficePdfs>>> & {
  omitted: number;
};
export function useOfficeBatch<T extends OfficeBatchItem>(
  items: T[],
  toolName: string,
  convert: (
    item: T,
    progress: (n: number, label?: string) => void,
    cancelled: () => boolean,
  ) => Promise<OfficeConvertedDocument>,
) {
  const [completed, setCompleted] = useState<Record<string, OfficeBatchOutput>>(
      {},
    ),
    completedRef = useRef(completed);
  const [errors, setErrors] = useState<
    Record<string, { key: string; message: string }>
  >({});
  const [processing, setProcessing] = useState(false),
    [progress, setProgress] = useState(0),
    [label, setLabel] = useState("Preparing your files…"),
    [message, setMessage] = useState(""),
    [result, setResult] = useState<Result | null>(null);
  const busy = useRef(false),
    generation = useRef(0),
    mounted = useRef(true),
    autoDownloadedRef = useRef(false);
  useEffect(() => {
    const controller = generation;
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current++;
    };
  }, []);
  useEffect(() => {
    setMessage("");
    const ids = new Map(items.map((i) => [i.id, officeItemKey(i)]));
    const keep = Object.fromEntries(
      Object.entries(completedRef.current).filter(
        ([id, o]) => ids.get(id) === o.key,
      ),
    );
    if (Object.keys(keep).length !== Object.keys(completedRef.current).length) {
      completedRef.current = keep;
      setCompleted(keep);
    }
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id, e]) => ids.get(id) === e.key),
      ),
    );
  }, [items]);
  useEffect(() => {
    if (result) window.scrollTo({ top: 0, behavior: "instant" });
  }, [result]);
  const ready = items.flatMap((item) =>
    completed[item.id]?.key === officeItemKey(item)
      ? [{ item, output: completed[item.id] }]
      : [],
  );
  const pending = items.length - ready.length;
  const back = useCallback(() => setResult(null), []);
  const cancel = () => {
    generation.current++;
    setLabel("Stopping conversion safely…");
  };
  const reset = () => {
    generation.current++;
    completedRef.current = {};
    setCompleted({});
    setErrors({});
    setResult(null);
    setMessage("");
    autoDownloadedRef.current = false;
  };
  const downloadReady = async () => {
    if (busy.current || !ready.length) return;
    busy.current = true;
    setProcessing(true);
    setLabel("Preparing your download…");
    setProgress(98);
    const id = ++generation.current;
    const cancelled = () => id !== generation.current || !mounted.current;
    try {
      const packed = await packageOfficePdfs(
        ready.map((r) => r.output),
        toolName + "-pdfs.zip",
        cancelled,
      );
      if (packed && !cancelled()) {
        autoDownloadedRef.current = false;
        setResult({ ...packed, omitted: items.length - ready.length });
      }
    } catch (e) {
      if (!cancelled())
        setMessage(
          e instanceof Error ? e.message : "Could not package the PDFs.",
        );
    } finally {
      busy.current = false;
      if (mounted.current) setProcessing(false);
    }
  };
  const run = async () => {
    if (busy.current || !items.length) return;
    if (!pending) {
      await downloadReady();
      return;
    }
    busy.current = true;
    setProcessing(true);
    setProgress(0);
    setMessage("");
    setResult(null);
    setLabel("Preparing your files…");
    autoDownloadedRef.current = false;
    const id = ++generation.current,
      cancelled = () => id !== generation.current || !mounted.current;
    setErrors({});
    try {
      const outputs = await runOfficeBatch(
        items,
        completedRef.current,
        convert,
        {
          cancelled,
          progress: (n, l) => {
            if (!cancelled()) {
              setProgress(n);
              setLabel(l);
            }
          },
          ready: (item, output) => {
            if (cancelled()) return;
            completedRef.current = {
              ...completedRef.current,
              [item.id]: output,
            };
            setCompleted(completedRef.current);
          },
          failed: (item, error) => {
            if (!cancelled())
              setErrors((current) => ({
                ...current,
                [item.id]: { key: officeItemKey(item), message: error },
              }));
          },
        },
      );
      if (cancelled()) return;
      const ordered = items.flatMap((item) =>
        outputs[item.id] ? [outputs[item.id]] : [],
      );
      if (ordered.length === items.length) {
        setLabel("Preparing your download…");
        setProgress(98);
        const packed = await packageOfficePdfs(
          ordered,
          toolName + "-pdfs.zip",
          cancelled,
        );
        if (packed && !cancelled()) {
          setResult({ ...packed, omitted: 0 });
          setProgress(100);
          toast.success("Your PDFs are ready.");
          trackToolConversionCompleted(toolName);
        }
      } else {
        setMessage(
          `${ordered.length} of ${items.length} PDFs are ready. Review the file errors, download the ready PDFs, or retry unfinished files.`,
        );
        trackToolConversionFailed(
          toolName,
          "One or more Office files could not be converted.",
        );
      }
    } catch (e) {
      if (!cancelled()) {
        setMessage(
          e instanceof Error ? e.message : "Conversion could not finish.",
        );
        trackToolConversionFailed(toolName, "Office batch conversion failed.");
      }
    } finally {
      busy.current = false;
      if (mounted.current) {
        setProcessing(false);
        if (cancelled())
          setMessage(
            "Conversion stopped. Completed PDFs are kept; retry processes only unfinished files.",
          );
      }
    }
  };
  return {
    completed,
    errors,
    ready,
    pending,
    processing,
    progress,
    label,
    message,
    result,
    run,
    cancel,
    reset,
    downloadReady,
    back,
    autoDownloadedRef,
  };
}
