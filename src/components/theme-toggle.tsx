"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * Light/dark toggle. Defaults to the system preference (set via
 * `defaultTheme="system"` on the provider); clicking sets an explicit
 * preference that overrides it from then on.
 *
 * `mounted` guards against a hydration mismatch: next-themes can only know
 * the real resolved theme after mounting client-side (the server has no
 * concept of the visitor's OS preference), so the icon renders a neutral
 * placeholder until then rather than guessing and potentially flashing the
 * wrong icon.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label={mounted ? (resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5" aria-hidden />
      ) : (
        <Moon className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
