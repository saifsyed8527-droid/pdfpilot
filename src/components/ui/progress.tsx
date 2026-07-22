"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  // `value === 0` means "processing but no real progress has been reported
  // yet" (the initial state `useProcessingTask` starts every task in) -
  // rendered as an honest indeterminate sweep rather than an empty bar that
  // looks frozen, since most tools only ever report a single 100% at
  // completion and never a real intermediate number.
  const indeterminate = !value;

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full bg-primary",
          indeterminate
            ? "w-1/3 animate-progress-indeterminate"
            : "w-full flex-1 transition-all"
        )}
        style={
          indeterminate
            ? undefined
            : { transform: `translateX(-${100 - (value || 0)}%)` }
        }
      />
    </ProgressPrimitive.Root>
  );
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }