"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderPdfPages, type RenderedPage } from "@/lib/engines/pdf-render-engine";
import { Progress } from "@/components/ui/progress";

export interface PageThumbnail {
  pageNumber: number;
  dataUrl: string;
}

interface PageThumbnailGridProps {
  file: File;
  selected: Set<number>;
  onToggle: (pageIndex: number) => void;
  onPagesLoaded?: (pageCount: number) => void;
  onThumbnailsReady?: (thumbnails: PageThumbnail[]) => void;
  onError?: (error: unknown) => void;
}

/** Renders every page of `file` as a real thumbnail (via the shared
 *  `renderPdfPages` canvas primitive, at a small scale since these are
 *  previews, not output) and displays them as an accessible, selectable
 *  grid. Each thumbnail is a real button — clickable, keyboard-focusable,
 *  and announced via `aria-pressed` — not a decorative image with a
 *  separate hit target, so screen reader and keyboard users get the same
 *  selection affordance as mouse users. */
export function PageThumbnailGrid({
  file,
  selected,
  onToggle,
  onPagesLoaded,
  onThumbnailsReady,
  onError,
}: PageThumbnailGridProps) {
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [renderProgress, setRenderProgress] = useState(0);

  // Latest callbacks read from a ref rather than the effect's dependency
  // array — these are typically fresh inline closures every render, and
  // including them as deps would re-run page rendering on every parent
  // re-render instead of only when `file` actually changes.
  const callbacksRef = useRef({ onPagesLoaded, onThumbnailsReady, onError });
  callbacksRef.current = { onPagesLoaded, onThumbnailsReady, onError };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setThumbnails([]);
    setRenderProgress(0);

    (async () => {
      try {
        const pages: RenderedPage[] = await renderPdfPages(file, 0.4, (pageNumber, totalPages) => {
          if (!cancelled) setRenderProgress((pageNumber / totalPages) * 100);
        });
        if (cancelled) return;
        const rendered = pages.map((page) => ({
          pageNumber: page.pageNumber,
          dataUrl: page.canvas.toDataURL("image/png"),
        }));
        setThumbnails(rendered);
        callbacksRef.current.onPagesLoaded?.(rendered.length);
        callbacksRef.current.onThumbnailsReady?.(rendered);
      } catch (error) {
        if (!cancelled) callbacksRef.current.onError?.(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-muted-foreground">Rendering page previews…</p>
        <Progress value={renderProgress} className="h-2" aria-label="Rendering page previews" />
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3"
      role="group"
      aria-label="Select pages"
    >
      {thumbnails.map((thumb) => {
        const pageIndex = thumb.pageNumber - 1;
        const isSelected = selected.has(pageIndex);
        return (
          <button
            key={thumb.pageNumber}
            type="button"
            aria-pressed={isSelected}
            aria-label={`Page ${thumb.pageNumber}${isSelected ? ", selected" : ""}`}
            onClick={() => onToggle(pageIndex)}
            className={cn(
              "relative rounded-lg border-2 overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot, not an optimizable remote asset */}
            <img src={thumb.dataUrl} alt="" className="w-full h-auto block" />
            <span className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
              <span className="text-[10px] font-medium bg-background/90 text-foreground px-1.5 py-0.5 rounded">
                {thumb.pageNumber}
              </span>
              {isSelected && (
                <CheckCircle2 className="h-4 w-4 text-primary bg-background rounded-full" aria-hidden="true" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
