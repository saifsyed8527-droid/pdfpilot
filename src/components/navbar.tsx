"use client";

import Link from "next/link";
import { ChevronDown, FileText, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getToolNavigation } from "@/lib/tool-navigation";

const TOOL_NAVIGATION = getToolNavigation();

export function Navbar() {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileOpenCategory, setMobileOpenCategory] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openCategory) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenCategory(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenCategory(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openCategory]);

  /** Arrow keys move focus through the open menu's links — the roving-focus
   *  behavior screen-reader and keyboard users expect from a menu. */
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
    <nav aria-label="Main" className="border-b bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-xl">
            <FileText className="h-6 w-6 text-primary" aria-hidden />
            <span>PDFPilot</span>
          </Link>

          <div ref={navRef} className="hidden md:flex items-center gap-1">
            {TOOL_NAVIGATION.map(({ navCategory, groups }) => (
              <div key={navCategory} className="relative">
                <button
                  type="button"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    openCategory === navCategory
                      ? "text-foreground bg-muted"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  aria-expanded={openCategory === navCategory}
                  aria-haspopup="true"
                  onClick={() =>
                    setOpenCategory((current) => (current === navCategory ? null : navCategory))
                  }
                >
                  {navCategory}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${openCategory === navCategory ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>

                {openCategory === navCategory && (
                  <div
                    className="absolute left-0 top-full mt-2 w-[min(90vw,680px)] rounded-xl border bg-white dark:bg-slate-950 shadow-xl p-7 grid grid-cols-2 sm:grid-cols-3 gap-7 animate-in fade-in slide-in-from-top-2 duration-200"
                    role="menu"
                    onKeyDown={handleMenuKeyDown}
                  >
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
                                  onClick={() => setOpenCategory(null)}
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
          </div>

          <button
            className="md:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
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

        {mobileMenuOpen && (
          <div
            id="mobile-menu"
            className="md:hidden pb-4 border-t max-h-[75vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200"
          >
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
        )}
      </div>
    </nav>
  );
}
