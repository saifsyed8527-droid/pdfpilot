"use client";

import Link from "next/link";
import { ChevronDown, FileText, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getToolNavigation } from "@/lib/tool-navigation";
import { TOOLS } from "@/lib/tools";
import { ThemeToggle } from "@/components/theme-toggle";

const TOOL_NAVIGATION = getToolNavigation();

/** Highest-frequency tools get a direct top-level link instead of living
 *  behind a menu — real registry entries, not new routes. */
const TOOLS_BY_PATH = new Map(TOOLS.map((tool) => [tool.path, tool]));
const FLAGSHIP_PATHS = ["/merge-pdf", "/split-pdf", "/compress-pdf"];
const FLAGSHIP_TOOLS = FLAGSHIP_PATHS.map((path) => TOOLS_BY_PATH.get(path)).filter(
  (tool) => tool !== undefined
);

/** Curated subset of the real "Convert" group, split by direction. Every
 *  path here is a real, shipped tool - not all ~40 Convert-group tools are
 *  listed, only the highest-frequency PDF conversions, so the dropdown
 *  stays short with no scrolling; the rest remain reachable from "All
 *  Tools" exactly as before. */
const CONVERT_TO_PDF_PATHS = ["/jpg-to-pdf", "/word-to-pdf", "/excel-to-pdf"];
const CONVERT_FROM_PDF_PATHS = ["/pdf-to-jpg", "/pdf-to-word", "/pdf-to-powerpoint"];
const CONVERT_TO_PDF = CONVERT_TO_PDF_PATHS.map((path) => TOOLS_BY_PATH.get(path)).filter(
  (tool) => tool !== undefined
);
const CONVERT_FROM_PDF = CONVERT_FROM_PDF_PATHS.map((path) => TOOLS_BY_PATH.get(path)).filter(
  (tool) => tool !== undefined
);

/**
 * Navigation architecture notes — this component is designed for 500+ tools,
 * not today's count, and is intended to be frozen:
 *
 * 1. Viewport safety is structural, not computed. The mega menu panel is
 *    anchored to the full-width <nav> element (`inset-x-0`), never to its
 *    trigger button — a panel that spans exactly the navbar's width cannot
 *    overflow the viewport horizontally, at any tool count, on any page,
 *    with zero collision-detection JavaScript.
 *
 * 2. Columns wrap automatically: `repeat(auto-fill, minmax(...))` lays out
 *    however many groups a navCategory has — 3 today, 12 later — into as
 *    many columns as the viewport genuinely fits, wrapping to new rows
 *    rather than clipping. No per-breakpoint column counts to maintain.
 *
 * 3. Vertical scale is capped by the viewport (`max-h` + scroll), so a
 *    navCategory with hundreds of tools scrolls inside the panel instead of
 *    growing past the fold.
 *
 * 4. Everything renders from the registry via getToolNavigation() — adding
 *    a tool to tools-data.json is the only step to appear here.
 */
/** Top-level menu identifiers. "convert" opens the small curated dropdown;
 *  "all" opens the full registry-driven mega menu (every navCategory/group/
 *  tool, unchanged) under a single entry point instead of one button per
 *  navCategory — same content, fewer top-level decisions. */
type OpenMenu = "convert" | "all" | null;

export function Navbar() {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileOpenCategory, setMobileOpenCategory] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenu]);

  /** Arrow keys move focus through the open menu's links — the roving-focus
   *  behavior keyboard users expect from a menu. */
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[role='menuitem']")];
    if (links.length === 0) return;
    const currentIndex = links.indexOf(document.activeElement as HTMLAnchorElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + delta + links.length) % links.length;
    links[nextIndex].focus();
  };

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className="sticky top-0 z-50 border-b bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm"
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-xl">
            <FileText className="h-6 w-6 text-primary" aria-hidden />
            <span>PDFPilot</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {/* Highest-frequency tools stand alone - only these three are
                always one click away, per the "high-frequency tools only,
                everything else behind a menu" nav rule. */}
            {FLAGSHIP_TOOLS.map((tool) => (
              <Link
                key={tool.path}
                href={tool.path}
                className="px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                {tool.name}
              </Link>
            ))}

            <button
              type="button"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                openMenu === "convert"
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              aria-expanded={openMenu === "convert"}
              aria-haspopup="true"
              onClick={() => setOpenMenu((current) => (current === "convert" ? null : "convert"))}
            >
              Convert PDF
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${openMenu === "convert" ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>

            <button
              type="button"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                openMenu === "all"
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              aria-expanded={openMenu === "all"}
              aria-haspopup="true"
              onClick={() => setOpenMenu((current) => (current === "all" ? null : "all"))}
            >
              All Tools
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${openMenu === "all" ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>

            <Link
              href="/guides"
              className="px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Guides
            </Link>
            <Link
              href="/about"
              className="px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              About
            </Link>
            <ThemeToggle />
          </div>

          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <button
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden />
              ) : (
                <Menu className="h-6 w-6" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Convert PDF - small curated dropdown, max 6 real tools, no scroll.
          Anchored to the nav itself (inset-x-0) for the same viewport-safety
          reason as the All Tools panel below. */}
      {openMenu === "convert" && (
        <div
          className="hidden md:block absolute inset-x-0 top-full border-b bg-white dark:bg-slate-950 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
          role="menu"
          aria-label="Convert PDF"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-2 gap-x-10 max-w-md">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3.5">
                  Convert to PDF
                </p>
                <ul className="space-y-1">
                  {CONVERT_TO_PDF.map((tool) => (
                    <li key={tool.path}>
                      <Link
                        href={tool.path}
                        role="menuitem"
                        className="block px-2.5 py-1.5 -mx-2.5 rounded-md text-sm text-foreground hover:text-primary hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:text-primary transition-colors"
                        onClick={() => setOpenMenu(null)}
                      >
                        {tool.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3.5">
                  Convert from PDF
                </p>
                <ul className="space-y-1">
                  {CONVERT_FROM_PDF.map((tool) => (
                    <li key={tool.path}>
                      <Link
                        href={tool.path}
                        role="menuitem"
                        className="block px-2.5 py-1.5 -mx-2.5 rounded-md text-sm text-foreground hover:text-primary hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:text-primary transition-colors"
                        onClick={() => setOpenMenu(null)}
                      >
                        {tool.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t">
              <Link
                href="/categories"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                role="menuitem"
                onClick={() => setOpenMenu(null)}
              >
                See all conversions →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* All Tools - the full registry-driven mega menu, unchanged in
          content (every navCategory/group/tool), now reached through one
          top-level entry point instead of one button per navCategory.
          Anchored to the nav itself (inset-x-0), so it is structurally
          incapable of horizontal viewport overflow. */}
      {openMenu === "all" && (
        <div
          className="hidden md:block absolute inset-x-0 top-full border-b bg-white dark:bg-slate-950 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
          role="menu"
          aria-label="All Tools"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="container mx-auto px-4 py-8 max-h-[min(70vh,32rem)] overflow-y-auto overscroll-contain space-y-8">
            {TOOL_NAVIGATION.map(({ navCategory, groups }) => (
              <div key={navCategory}>
                <h3 className="text-sm font-semibold text-foreground mb-4">{navCategory}</h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-10 gap-y-8">
                  {groups.map(({ group, tools }) => {
                    const GroupIcon = tools[0]?.icon;
                    return (
                      <div key={group}>
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3.5">
                          {GroupIcon && <GroupIcon className="h-3.5 w-3.5" aria-hidden />}
                          {group}
                        </p>
                        <ul className="space-y-1">
                          {tools.map((tool) => (
                            <li key={tool.path}>
                              <Link
                                href={tool.path}
                                role="menuitem"
                                className="block px-2.5 py-1.5 -mx-2.5 rounded-md text-sm text-foreground hover:text-primary hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:text-primary transition-colors"
                                onClick={() => setOpenMenu(null)}
                              >
                                {tool.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pt-5 border-t">
              <Link
                href="/categories"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                role="menuitem"
                onClick={() => setOpenMenu(null)}
              >
                Browse all categories →
              </Link>
            </div>
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden border-t max-h-[75vh] overflow-y-auto overscroll-contain animate-in fade-in slide-in-from-top-1 duration-200"
        >
          <div className="container mx-auto px-4 pb-4">
            <div className="flex flex-col gap-1 pt-4">
              {TOOL_NAVIGATION.map(({ navCategory, groups }) => (
                <div key={navCategory} className="border-b last:border-b-0">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between py-3.5 text-sm font-semibold"
                    aria-expanded={mobileOpenCategory === navCategory}
                    onClick={() =>
                      setMobileOpenCategory((current) =>
                        current === navCategory ? null : navCategory
                      )
                    }
                  >
                    {navCategory}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${mobileOpenCategory === navCategory ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>

                  {mobileOpenCategory === navCategory && (
                    <div className="pb-4 space-y-5 animate-in fade-in duration-150">
                      {groups.map(({ group, tools }) => {
                        const GroupIcon = tools[0]?.icon;
                        return (
                          <div key={group}>
                            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">
                              {GroupIcon && <GroupIcon className="h-3.5 w-3.5" aria-hidden />}
                              {group}
                            </p>
                            <ul className="space-y-1 pl-1">
                              {tools.map((tool) => (
                                <li key={tool.path}>
                                  <Link
                                    href={tool.path}
                                    className="block py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    {tool.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              <Link
                href="/guides"
                className="py-3.5 text-sm font-medium text-muted-foreground hover:text-foreground border-b"
                onClick={() => setMobileMenuOpen(false)}
              >
                Guides
              </Link>
              <Link
                href="/about"
                className="py-3.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
