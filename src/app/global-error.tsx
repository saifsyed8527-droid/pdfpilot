"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled global application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        <main className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center py-12">
          <div className="container mx-auto px-4 max-w-2xl text-center space-y-6">
            <h1 className="text-2xl font-bold">PDFPilot</h1>
            <p className="text-lg font-semibold">Something went wrong</p>
            <p className="text-muted-foreground">
              The application failed to load. Please try again — your files were never uploaded
              anywhere, so nothing was lost.
            </p>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-2 text-sm font-medium hover:bg-primary/90"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
