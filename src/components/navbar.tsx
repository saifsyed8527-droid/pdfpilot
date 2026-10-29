"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, FileText, Menu, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { getToolNavigation } from "@/lib/tool-navigation";
import { TOOLS, type Tool } from "@/lib/tools";
import { getCategoryStyle } from "@/lib/category-colors";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { localizedCorePath, localizedToolPath, parseLocalizedPath } from "@/lib/i18n/url-strategy";
import { localizedToolName, uiText } from "@/lib/i18n/ui-copy";
import { getLocale } from "@/lib/i18n/locales";

const TOOL_NAVIGATION = getToolNavigation();

const TOOLS_BY_PATH = new Map(TOOLS.map((tool) => [tool.path, tool]));
// Header shortcuts are intentionally independent of the homepage catalog order.
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
  "/pdf-to-markdown",
];
const CONVERT_TO_PDF = CONVERT_TO_PDF_PATHS.map((path) => TOOLS_BY_PATH.get(path)).filter(
  (tool): tool is Tool => tool !== undefined
);
const CONVERT_FROM_PDF = CONVERT_FROM_PDF_PATHS.map((path) => TOOLS_BY_PATH.get(path)).filter(
  (tool): tool is Tool => tool !== undefined
);

// The desktop menu is derived from the same registry as mobile navigation, so
// every production tool is discoverable instead of only the original handful
// of flagship links.
const MEGA_MENU = TOOL_NAVIGATION.map((category) => ({
  name: category.navCategory,
  tools: category.groups.flatMap((group) => group.tools),
}));

const NAV_ICON_COLORS: Record<string, { background: string; color: string }> = {
  organize: { background: "#fee2d5", color: "#f26f4f" },
  optimize: { background: "#e3f4d4", color: "#78b84f" },
  convert: { background: "#fff3b8", color: "#e4bd12" },
  "convert-alt": { background: "#dce8ff", color: "#4f7fca" },
  edit: { background: "#efd9ea", color: "#af649d" },
  security: { background: "#dce8ff", color: "#4f7fca" },
  ai: { background: "#e7dcff", color: "#7c4fe0" },
};

function ToolMenuSearch({ query, onChange, label, clearLabel }: { query: string; onChange: (value: string) => void; label: string; clearLabel: string }) {
  const id = useId();
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <Search aria-hidden className="pointer-events-none absolute start-3 top-3 h-5 w-5 text-slate-400" />
      <input id={id} type="search" value={query} onChange={event => onChange(event.target.value)} placeholder={label}
        autoComplete="off" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 ps-10 pe-12 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950" />
      {query && <button type="button" onClick={() => { onChange(""); document.getElementById(id)?.focus(); }} aria-label={clearLabel}
        className="absolute end-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"><X aria-hidden className="h-4 w-4" /></button>}
    </div>
  );
}

const normalizeSearch = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();

type OpenMenu = "convert" | "all" | null;

export function Navbar() {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileOpenCategory, setMobileOpenCategory] = useState<string | null>(null);
  const [allToolsHasMore, setAllToolsHasMore] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const allToolsScrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const parsedPath = parseLocalizedPath(pathname);
  const t = (text: string) => uiText(parsedPath.locale, text);
  const toolName = (tool: Tool) => localizedToolName(tool.slug, parsedPath.locale, tool.name);

  const searchTerms = normalizeSearch(menuQuery).trim().split(/\s+/).filter(Boolean);
  const visibleMenu = MEGA_MENU.map(category => ({
    ...category,
    tools: category.tools.filter(tool => {
      const text = normalizeSearch(`${toolName(tool)} ${tool.name} ${tool.slug.replaceAll("-", " ")} ${tool.tagline} ${t(category.name)}`);
      return searchTerms.every(term => text.includes(term));
    }),
  })).filter(category => category.tools.length > 0);
  const resultCount = visibleMenu.reduce((count, category) => count + category.tools.length, 0);
  const toggleMenu = (menu: OpenMenu, trigger: HTMLElement) => {
    menuTriggerRef.current = trigger;
    setMenuQuery("");
    setOpenMenu(current => current === menu ? null : menu);
  };

  useEffect(() => {
    // Next preserves the root layout during client navigation. Keep the page's
    // accessibility language in sync; never modify uploaded document content.
    const locale = getLocale(parsedPath.locale)!;
    document.documentElement.lang = locale.code;
    document.documentElement.dir = locale.dir;
  }, [parsedPath.locale]);

  useEffect(() => {
    if (openMenu !== "all") return;
    const el = allToolsScrollRef.current;
    if (!el) return;

    const measure = () => setAllToolsHasMore(el.scrollHeight - el.clientHeight - el.scrollTop > 4);
    measure();

    const onScroll = () => measure();
    el.addEventListener("scroll", onScroll);
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, [openMenu, menuQuery]);

  useEffect(() => {
    setOpenMenu(null);
    setMobileMenuOpen(false);
    setMobileOpenCategory(null);
    setMenuQuery("");
  }, [pathname]);

  useEffect(() => {
    if (!openMenu && !mobileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
        setMobileMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMobileMenuOpen(false);
        setMenuQuery("");
        menuTriggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenu, mobileMenuOpen]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[href]")];
    if (links.length === 0) return;
    const currentIndex = links.indexOf(document.activeElement as HTMLAnchorElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = currentIndex < 0 ? (delta > 0 ? 0 : links.length - 1) : (currentIndex + delta + links.length) % links.length;
    links[nextIndex].focus();
  };

  const ToolIconSquare = ({ tool }: { tool: Tool }) => {
    const iconStyle = getCategoryStyle(tool);
    const colors = NAV_ICON_COLORS[iconStyle.label] ?? NAV_ICON_COLORS.organize;
    const ToolIcon = tool.icon ?? FileText;
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: colors.background, color: colors.color }}
        aria-hidden
      >
        <ToolIcon className="h-3.5 w-3.5" />
      </span>
    );
  };

  return (
    <nav
      ref={navRef}
      dir={getLocale(parsedPath.locale)?.dir}
      aria-label="Main"
      className="sticky top-0 z-50 border-b bg-white dark:bg-slate-900"
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href={localizedCorePath("home", parsedPath.locale)} className="flex items-center gap-2 font-bold text-xl text-slate-950 dark:text-white">
            <FileText className="h-6 w-6 text-red-600" aria-hidden />
            <span>PDFPilot</span>
          </Link>

          <div className="hidden xl:flex items-center gap-1">
            {FLAGSHIP_TOOLS.map((tool) => (
              <Link
                key={tool.path}
                href={localizedToolPath(tool.slug, parsedPath.locale)}
                className="px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                {toolName(tool)}
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
              aria-controls="convert-menu"
              onClick={event => toggleMenu("convert", event.currentTarget)}
            >
              {t("Convert PDF")}
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
              aria-controls="all-tools-menu"
              onClick={event => toggleMenu("all", event.currentTarget)}
            >
              {t("All Tools")}
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${openMenu === "all" ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>

            <Link
              href="/guides"
              className="px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {t("Guides")}
            </Link>
            <Link
              href="/about"
              className="px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {t("About")}
            </Link>
            <LanguageSwitcher currentPathname={pathname} />
            <ThemeToggle />
          </div>

          <div className="xl:hidden flex items-center gap-1">
            <LanguageSwitcher currentPathname={pathname} />
            <ThemeToggle />
            <button
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              onClick={event => { menuTriggerRef.current = event.currentTarget; setMenuQuery(""); setMobileMenuOpen(!mobileMenuOpen); }}
              aria-label={t(mobileMenuOpen ? "Close menu" : "Open menu")}
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
          className="hidden xl:block absolute inset-x-0 top-full border-b bg-white dark:bg-slate-900 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
          id="convert-menu"
          role="menu"
          aria-label={t("Convert PDF")}
          onKeyDown={handleMenuKeyDown}
        >
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-2 gap-x-10 max-w-2xl">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3.5">
                  {t("Convert to PDF")}
                </p>
                <ul className="space-y-1">
                  {CONVERT_TO_PDF.map((tool) => (
                    <li key={tool.path}>
                      <Link
                        href={localizedToolPath(tool.slug, parsedPath.locale)}
                        role="menuitem"
                        className="flex items-center gap-3 px-2.5 py-2 -mx-2.5 rounded-md text-sm text-foreground hover:bg-muted focus-visible:bg-muted transition-colors"
                        onClick={() => setOpenMenu(null)}
                      >
                        <ToolIconSquare tool={tool} />
                        {toolName(tool)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3.5">
                  {t("Convert from PDF")}
                </p>
                <ul className="space-y-1">
                  {CONVERT_FROM_PDF.map((tool) => (
                    <li key={tool.path}>
                      <Link
                        href={localizedToolPath(tool.slug, parsedPath.locale)}
                        role="menuitem"
                        className="flex items-center gap-3 px-2.5 py-2 -mx-2.5 rounded-md text-sm text-foreground hover:bg-muted focus-visible:bg-muted transition-colors"
                        onClick={() => setOpenMenu(null)}
                      >
                        <ToolIconSquare tool={tool} />
                        {toolName(tool)}
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
                {t("See all conversions →")}
              </Link>
            </div>
          </div>
        </div>
      )}

      {openMenu === "all" && (
        <div
          className="hidden xl:block absolute inset-x-0 top-full border-b bg-white dark:bg-slate-900 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
          id="all-tools-menu"
          role="region"
          aria-label={t("All Tools")}
          onKeyDown={handleMenuKeyDown}
        >
          <div className="container mx-auto flex items-center gap-6 px-4 py-4">
            <div className="w-full max-w-xl"><ToolMenuSearch query={menuQuery} onChange={setMenuQuery} label={t("Search tools")} clearLabel={t("Clear")} /></div>
            <span className="text-sm text-muted-foreground whitespace-nowrap" role="status">{t("Results")}: {resultCount}</span>
          </div>
          <div className="relative">
            <div
              ref={allToolsScrollRef}
              className="container mx-auto px-4 py-6 max-h-[min(65dvh,38rem)] overflow-y-auto overscroll-contain"
            >
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-8">
                {visibleMenu.map((category) => (
                  <div key={t(category.name)}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                      {t(category.name)}
                    </h3>
                    <ul className="space-y-1">
                      {category.tools.map((tool) => (
                        <li key={tool.path}>
                          <Link
                            href={parsedPath.locale === "en" ? tool.path : localizedToolPath(tool.slug, parsedPath.locale)}
                            className="flex items-center gap-3 px-2.5 py-2 -mx-2.5 rounded-md text-sm text-foreground hover:bg-muted focus-visible:bg-muted transition-colors"
                            onClick={() => setOpenMenu(null)}
                          >
                            <ToolIconSquare tool={tool} />
                            {toolName(tool)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {resultCount === 0 && <p role="status" className="py-10 text-center text-muted-foreground">{t("No matching tools. Try another search.")}</p>}
              <div className="pt-5 mt-8 border-t border-border">
                <Link
                  href="/categories"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setOpenMenu(null)}
                >
                  {t("Browse all categories →")}
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
          onKeyDown={handleMenuKeyDown}
          className="xl:hidden border-t border-border max-h-[75vh] overflow-y-auto overscroll-contain animate-in fade-in slide-in-from-top-1 duration-200 bg-white dark:bg-slate-900"
        >
          <div className="container mx-auto px-4 pb-4">
            <div className="sticky top-0 z-10 bg-white py-3 dark:bg-slate-900"><ToolMenuSearch query={menuQuery} onChange={setMenuQuery} label={t("Search tools")} clearLabel={t("Clear")} /></div>
            <div className="flex flex-col gap-1">
              {visibleMenu.map(({ name, tools }, index) => {
                const expanded = Boolean(menuQuery.trim()) || mobileOpenCategory === name;
                return (
                  <div key={name} className="border-b border-border">
                    <button type="button" className="flex w-full items-center justify-between gap-3 py-3.5 text-start text-sm font-semibold"
                      aria-expanded={expanded} aria-controls={`mobile-tools-${index}`}
                      onClick={() => setMobileOpenCategory(current => current === name ? null : name)}>
                      <span>{t(name)} <span className="ms-2 font-normal text-muted-foreground">{tools.length}</span></span>
                      <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                    {expanded && <ul id={`mobile-tools-${index}`} className="space-y-1 pb-4">
                      {tools.map(tool => <li key={tool.slug}>
                        <Link href={localizedToolPath(tool.slug, parsedPath.locale)} onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-3 rounded-lg px-2 py-3 text-sm hover:bg-muted focus-visible:bg-muted">
                          <ToolIconSquare tool={tool} />{toolName(tool)}
                        </Link>
                      </li>)}
                    </ul>}
                  </div>
                );
              })}
              {resultCount === 0 && <p role="status" className="py-8 text-center text-sm text-muted-foreground">{t("No matching tools. Try another search.")}</p>}

              <Link
                href="/guides"
                className="py-3.5 text-sm font-medium text-muted-foreground hover:text-foreground border-b border-border"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("Guides")}
              </Link>
              <Link
                href="/about"
                className="py-3.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("About")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
