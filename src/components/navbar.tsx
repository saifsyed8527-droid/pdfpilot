"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, FileText, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getToolNavigation } from "@/lib/tool-navigation";
import { TOOLS, type Tool } from "@/lib/tools";
import { getCategoryStyle } from "@/lib/category-colors";
import { ThemeToggle } from "@/components/theme-toggle";

const TOOL_NAVIGATION = getToolNavigation();

const TOOLS_BY_PATH = new Map(TOOLS.map((tool) => [tool.path, tool]));
const FLAGSHIP_PATHS = ["/merge-pdf", "/split-pdf", "/compress-pdf"];
const FLAGSHIP_TOOLS = FLAGSHIP_PATHS.map((path) => TOOLS_BY_PATH.get(path)).filter(
  (tool): tool is Tool => tool !== undefined
);

const CONVERT_TO_PDF_PATHS = [
  "/jpg-to-pdf",
  "/word-to-pdf",
  "/powerpoint-to-pdf",
  "/excel-to-pdf",
  "/html-to-pdf",
];
const CONVERT_FROM_PDF_PATHS = [
  "/pdf-to-jpg",
  "/pdf-to-word",
  "/pdf-to-powerpoint",
  "/pdf-to-excel",
  "/pdf-to-pdfa",
];
const CONVERT_TO_PDF = CONVERT_TO_PDF_PATHS.map((path) => TOOLS_BY_PATH.get(path)).filter(
  (tool): tool is Tool => tool !== undefined
);
const CONVERT_FROM_PDF = CONVERT_FROM_PDF_PATHS.map((path) => TOOLS_BY_PATH.get(path)).filter(
  (tool): tool is Tool => tool !== undefined
);

const MEGA_MENU_CATEGORIES: { name: string; paths: string[] }[] = [
  {
    name: "ORGANIZE PDF",
    paths: [
      "/merge-pdf",
      "/split-pdf",
      "/delete-pages",
      "/extract-pages",
      "/rearrange-pages",
      "/scan-to-pdf",
    ],
  },
  {
    name: "OPTIMIZE PDF",
    paths: ["/compress-pdf", "/repair-pdf", "/ocr-pdf"],
  },
  {
    name: "CONVERT TO PDF",
    paths: [
      "/jpg-to-pdf",
      "/word-to-pdf",
      "/powerpoint-to-pdf",
      "/excel-to-pdf",
      "/html-to-pdf",
    ],
  },
  {
    name: "CONVERT FROM PDF",
    paths: [
      "/pdf-to-jpg",
      "/pdf-to-word",
      "/pdf-to-powerpoint",
      "/pdf-to-excel",
      "/pdf-to-pdfa",
    ],
  },
  {
    name: "EDIT PDF",
    paths: [
      "/rotate-pdf",
      "/add-page-numbers",
      "/watermark-pdf",
      "/crop-pdf",
      "/edit-pdf",
      "/fill-pdf",
    ],
  },
  {
    name: "PDF SECURITY",
    paths: [
      "/unlock-pdf",
      "/lock-pdf",
      "/sign-pdf",
      "/redact-pdf",
      "/compare-pdf",
    ],
  },
  {
    name: "PDF INTELLIGENCE",
    paths: ["/summary-generator", "/translate-pdf", "/pdf-to-markdown"],
  },
];

const MEGA_MENU = MEGA_MENU_CATEGORIES.map(({ name, paths }) => ({
  name,
  tools: paths.map((path) => TOOLS_BY_PATH.get(path)).filter((tool): tool is Tool => tool !== undefined),
})).filter((cat) => cat.tools.length > 0);

type OpenMenu = "convert" | "all" | null;

export function Navbar() {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileOpenCategory, setMobileOpenCategory] = useState<string | null>(null);
  const [allToolsHasMore, setAllToolsHasMore] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const allToolsScrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (openMenu !== "all") return;
    const el = allToolsScrollRef.current;
    if (!el) return;

    const measure = () => setAllToolsHasMore(el.scrollHeight - el.clientHeight > 4);
    measure();

    const onScroll = () => measure();
    el.addEventListener("scroll", onScroll);
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, [openMenu]);

  useEffect(() => {
    setOpenMenu(null);
    setMobileMenuOpen(false);
    setMobileOpenCategory(null);
  }, [pathname]);

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

  const ToolIconSquare = ({ tool }: { tool: Tool }) => {
    const style = getCategoryStyle(tool);
    const ToolIcon = tool.icon ?? FileText;
    return (
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${style.bgClass}`}
        aria-hidden
      >
        <ToolIcon className={`h-3.5 w-3.5 ${style.iconClass}`} />
      </span>
    );
  };

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className="sticky top-0 z-50 border-b bg-white dark:bg-slate-900"
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-xl">
            <FileText className="h-6 w-6 text-primary" aria-hidden />
            <span>PDFPilot</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
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

      {openMenu === "convert" && (
        <div
          className="hidden md:block absolute inset-x-0 top-full border-b bg-white dark:bg-slate-900 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
          role="menu"
          aria-label="Convert PDF"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-2 gap-x-10 max-w-2xl">
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
                        className="flex items-center gap-3 px-2.5 py-2 -mx-2.5 rounded-md text-sm text-foreground hover:bg-muted focus-visible:bg-muted transition-colors"
                        onClick={() => setOpenMenu(null)}
                      >
                        <ToolIconSquare tool={tool} />
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
                        className="flex items-center gap-3 px-2.5 py-2 -mx-2.5 rounded-md text-sm text-foreground hover:bg-muted focus-visible:bg-muted transition-colors"
                        onClick={() => setOpenMenu(null)}
                      >
                        <ToolIconSquare tool={tool} />
                        {tool.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-border">
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

      {openMenu === "all" && (
        <div
          className="hidden md:block absolute inset-x-0 top-full border-b bg-white dark:bg-slate-900 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
          role="menu"
          aria-label="All Tools"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="relative">
            <div
              ref={allToolsScrollRef}
              className="container mx-auto px-4 py-6 max-h-[min(80vh,44rem)] overflow-y-auto overscroll-contain"
            >
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-8">
                {MEGA_MENU.map((category) => (
                  <div key={category.name}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                      {category.name}
                    </h3>
                    <ul className="space-y-1">
                      {category.tools.map((tool) => (
                        <li key={tool.path}>
                          <Link
                            href={tool.path}
                            role="menuitem"
                            className="flex items-center gap-3 px-2.5 py-2 -mx-2.5 rounded-md text-sm text-foreground hover:bg-muted focus-visible:bg-muted transition-colors"
                            onClick={() => setOpenMenu(null)}
                          >
                            <ToolIconSquare tool={tool} />
                            {tool.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="pt-5 mt-8 border-t border-border">
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

            {allToolsHasMore && (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent dark:from-slate-900"
                aria-hidden
              />
            )}
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden border-t border-border max-h-[75vh] overflow-y-auto overscroll-contain animate-in fade-in slide-in-from-top-1 duration-200 bg-white dark:bg-slate-900"
        >
          <div className="container mx-auto px-4 pb-4">
            <div className="flex flex-col gap-1 pt-4">
              {TOOL_NAVIGATION.map(({ navCategory, groups }) => (
                <div key={navCategory} className="border-b border-border last:border-b-0">
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
                                    className="flex items-center gap-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    <ToolIconSquare tool={tool} />
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
                className="py-3.5 text-sm font-medium text-muted-foreground hover:text-foreground border-b border-border"
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
