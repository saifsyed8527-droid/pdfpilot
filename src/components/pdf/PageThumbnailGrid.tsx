"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderPdfPages } from "@/lib/engines/pdf-render-engine";
import { Progress } from "@/components/ui/progress";

export interface PageThumbnail {
  pageNumber: number;
  dataUrl: string;
}

interface PageThumbnailGridProps {
  file: File;
  /** Whole-thumbnail select/deselect — omit both `selected` and `onToggle`
   *  for tools where the grid is for per-page actions rather than
   *  selecting a subset (e.g. Rotate PDF). When omitted, each thumbnail
   *  renders as a plain container instead of a toggle button, so
   *  `renderPageAction`'s real controls aren't nested inside one. */
  selected?: Set<number>;
  onToggle?: (pageIndex: number) => void;
  /** Degrees to visually rotate each page's thumbnail (0/90/180/270) —
   *  a real preview of pending per-page rotation state, not decorative. */
  pageRotations?: Record<number, number>;
  /** Renders arbitrary controls onto each thumbnail (e.g. rotate-left/
   *  rotate-right buttons) — kept generic rather than rotation-specific
   *  so future per-page-action tools (e.g. Insert Pages) reuse this same
   *  slot instead of a new component. */
  renderPageAction?: (pageIndex: number) => ReactNode;
  onPagesLoaded?: (pageCount: number) => void;
  onThumbnailsReady?: (thumbnails: PageThumbnail[]) => void;
  onError?: (error: unknown) => void;
}

/** Renders every page of `file` as a real thumbnail (via the shared
 *  `renderPdfPages` canvas primitive, at a small scale since these are
 *  previews, not output) and displays them as an accessible grid. In
 *  selection mode (`selected`/`onToggle` provided), each thumbnail is a
 *  real toggle button, keyboard-focusable and announced via
 *  `aria-pressed`. In action mode (`renderPageAction` provided instead),
 *  each thumbnail is a plain container so the real, focusable controls
 *  it renders aren't nested inside another interactive element. */
export function PageThumbnailGrid({
  file,
  selected,
  onToggle,
  pageRotations,
  renderPageAction,
  onPagesLoaded,
  onThumbnailsReady,
  onError,
}: PageThumbnailGridProps) {
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPageCount, setTotalPageCount] = useState(0);

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
    setTotalPageCount(0);

    (async () => {
      try {
        // Renders and displays pages progressively rather than waiting for
        // the whole document — measured need: a real 150-page PDF took over
        // two minutes with the old all-or-nothing wait, showing the user
        // nothing until every page was done. Page 1 now appears (and is
        // immediately interactive) the moment it's ready, while the rest
        // continue rendering in the background.
        await renderPdfPages(
          file,
          0.4,
          (pageNumber, totalPages) => {
            if (cancelled) return;
            if (pageNumber === 1) {
              setTotalPageCount(totalPages);
              callbacksRef.current.onPagesLoaded?.(totalPages);
            }
          },
          (page, totalPages) => {
            if (cancelled) return;
            const thumb = { pageNumber: page.pageNumber, dataUrl: page.canvas.toDataURL("image/png") };
            setLoading(false);
            setThumbnails((prev) => {
              const next = [...prev, thumb];
              if (next.length === totalPages) callbacksRef.current.onThumbnailsReady?.(next);
              return next;
            });
          }
        );
      } catch (error) {
        if (!cancelled) {
          callbacksRef.current.onError?.(error);
          setLoading(false);
        }
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
        <Progress className="h-2" aria-label="Rendering page previews" />
      </div>
    );
  }

  const isSelectionMode = selected !== undefined && onToggle !== undefined;
  const stillLoadingMore = thumbnails.length < totalPageCount;

  return (
    <div className="space-y-3">
    <div
      className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3"
      role="group"
      aria-label={isSelectionMode ? "Select pages" : "Page actions"}
    >
      {thumbnails.map((thumb) => {
        const pageIndex = thumb.pageNumber - 1;
        const isSelected = selected?.has(pageIndex) ?? false;
        const rotation = pageRotations?.[pageIndex] ?? 0;

        const image = (
          // eslint-disable-next-line @next/next/no-img-element -- real client-rendered canvas snapshot, not an optimizable remote asset
          <img
            src={thumb.dataUrl}
            alt=""
            className="w-full h-auto block transition-transform"
            style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
          />
        );

        const pageBadge = (
          <span className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
            <span className="text-[10px] font-medium bg-background/90 text-foreground px-1.5 py-0.5 rounded">
              {thumb.pageNumber}
            </span>
            {isSelected && (
              <CheckCircle2 className="h-4 w-4 text-primary bg-background rounded-full" aria-hidden="true" />
            )}
          </span>
        );

        if (isSelectionMode) {
          return (
            <button
              key={thumb.pageNumber}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Page ${thumb.pageNumber}${isSelected ? ", selected" : ""}`}
              onClick={() => onToggle!(pageIndex)}
              className={cn(
                "relative rounded-lg border-2 overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
            >
              {image}
              {pageBadge}
            </button>
          );
        }

        return (
          <div
            key={thumb.pageNumber}
            className="relative rounded-lg border-2 border-border overflow-hidden flex items-center justify-center bg-muted/30"
          >
            <div className="w-full aspect-[3/4] flex items-center justify-center overflow-hidden">{image}</div>
            {pageBadge}
            {renderPageAction && (
              <div className="absolute top-1 right-1 flex gap-1">{renderPageAction(pageIndex)}</div>
            )}
          </div>
        );
      })}
    </div>
    {stillLoadingMore && (
      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
        Loading page {thumbnails.length + 1} of {totalPageCount}… you can start selecting pages already loaded.
      </p>
    )}
    </div>
  );
}
