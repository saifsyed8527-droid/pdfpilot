"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Ban,
  BookOpen,
  Clock,
  FileSpreadsheet,
  FolderOpen,
  Search,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { TOOLS } from "@/lib/tools";
import { CATEGORIES } from "@/lib/content/categories";
import { searchAll, type SearchEntry } from "@/lib/search";
import { getRecentSearches, recordSearch, clearRecentSearches } from "@/lib/recent-searches";
import { trackSearchPerformed, trackSearchResultClicked } from "@/lib/analytics/events";

interface HomeClientProps {
  /** Slim, server-built search index — see src/app/page.tsx. */
  searchIndex: SearchEntry[];
}

/**
 * Every homepage section is a fixed-size, registry-derived slice — none of
 * them grow with the total tool count, which is what keeps this page clean
 * at 13 tools and at 500. Full tool listings live on category pages and in
 * the mega menu, never here.
 *
 * "Popular" derives from the registry's curated `order` ranking (flagship
 * tools first); "Recently Added" derives from the same field reversed, since
 * `order` has only ever grown append-only as tools shipped. Neither is usage
 * data — when real analytics exist, only these lines change.
 */
const QUICK_ACTIONS = [...TOOLS].sort((a, b) => a.order - b.order).slice(0, 4);
const POPULAR_TOOLS = [...TOOLS].sort((a, b) => a.order - b.order).slice(0, 6);
const RECENT_TOOLS = [...TOOLS].sort((a, b) => b.order - a.order).slice(0, 4);

const TOOLS_BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

/** Category cards derive everything — icon, tool count — from the category's
 *  own `contains` refs resolved against the Tool registry. */
const CATEGORY_CARDS = CATEGORIES.map((category) => {
  const containedTools = category.contains
    .filter((ref) => ref.type === "tool")
    .map((ref) => TOOLS_BY_ID.get(ref.id))
    .filter((tool) => tool !== undefined);
  return {
    path: category.path,
    title: category.title,
    description: category.description,
    toolCount: containedTools.length,
    icon: containedTools[0]?.icon ?? FolderOpen,
  };
});

const WHY_PDFPILOT = [
  {
    icon: ShieldCheck,
    title: "Your files never leave your device",
    body: "Every tool runs entirely in your browser using client-side processing — nothing is uploaded to a server, so there's nothing to worry about with sensitive documents.",
  },
  {
    icon: Zap,
    title: "No waiting on uploads",
    body: "Because your file never has to travel to a server and back, processing starts the moment you drop it in — even large PDFs.",
  },
  {
    icon: Ban,
    title: "No account, no limits",
    body: "Every tool is free to use as often as you need, with no sign-up, no daily task caps, and no watermarks on your files.",
  },
];

const RESULT_TYPE_LABELS: Record<SearchEntry["type"], string> = {
  tool: "Tools",
  guide: "Guides",
  category: "Categories",
};

function SectionHeading({
  icon: Icon,
  title,
  action,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          {action.label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function SearchResultGroup({
  label,
  entries,
  onResultClick,
}: {
  label: string;
  entries: SearchEntry[];
  onResultClick?: (entry: SearchEntry) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {label}
      </p>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li key={entry.path}>
            <Link
              href={entry.path}
              onClick={() => onResultClick?.(entry)}
              className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-white dark:bg-slate-900 hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <span>
                <span className="block font-medium group-hover:text-primary transition-colors">
                  {entry.name}
                </span>
                <span className="block text-sm text-muted-foreground mt-0.5">
                  {entry.description}
                </span>
              </span>
              <ArrowRight
                className="h-4 w-4 mt-1 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HomeClient({ searchIndex }: HomeClientProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchAll(searchIndex, query), [searchIndex, query]);
  const isSearching = query.trim().length > 0;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Loaded client-side only (localStorage doesn't exist during SSR) —
  // read once on mount, same pattern as every other client-only browser
  // API read in this codebase.
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const handleResultClick = (entry: SearchEntry) => {
    recordSearch(query);
    setRecentSearches(getRecentSearches());
    trackSearchResultClicked(query, entry.type, entry.path);
  };

  // Debounced so a search event fires once per pause in typing, not once
  // per keystroke — GA4 measures "the queries people actually search for,"
  // not every intermediate character.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const timeout = setTimeout(() => {
      trackSearchPerformed(trimmed, results.total);
    }, 600);
    return () => clearTimeout(timeout);
  }, [query, results.total]);

  const handleClearRecentSearches = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  // Cmd/Ctrl+K focuses search from anywhere on the page — the standard
  // "jump to search" shortcut. Escape (only while the input has focus)
  // clears the query and gives it back, rather than blurring away from
  // what the user was just doing.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
    }
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 pt-16 pb-24 md:pt-24">
        {/* Hero + universal search */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="flex items-center justify-center gap-2.5 mb-5">
            <FileSpreadsheet className="h-11 w-11 text-primary" aria-hidden />
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              PDFPilot
            </h1>
          </div>
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">
            Free PDF Tools for Everyone
          </h2>
          <p className="text-base md:text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Merge, split, compress and convert PDFs instantly — right in your browser.
            No sign-up required.
          </p>

          <div className="relative max-w-xl mx-auto">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search tools, guides, and categories…"
              aria-label="Search tools, guides, and categories"
              className="w-full pl-12 pr-16 py-4 rounded-2xl border bg-white dark:bg-slate-900 text-base shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/40 focus:shadow-md"
            />
            {!query && (
              <kbd className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 items-center gap-0.5 rounded-md border bg-muted px-1.5 py-1 text-xs font-medium text-muted-foreground">
                ⌘K
              </kbd>
            )}
          </div>

          {/* Quick actions — the four flagship tools, one tap away */}
          {!isSearching && (
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              {QUICK_ACTIONS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.path}
                    href={tool.path}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {tool.name}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Recent searches — real, this browser's own history only. Not
              "popular searches": that needs real aggregate usage data,
              which doesn't exist until analytics is actually collecting
              it (see docs/analytics-instrumentation.md). */}
          {!isSearching && recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
              <span className="text-xs text-muted-foreground">Recent:</span>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="px-3 py-1 rounded-full border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  {term}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearRecentSearches}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Search results replace the browsing sections entirely */}
        {isSearching ? (
          <div className="max-w-2xl mx-auto space-y-10" role="region" aria-live="polite">
            {results.total === 0 ? (
              <div className="text-center py-12 space-y-6">
                <p className="text-muted-foreground">
                  Nothing matches &quot;{query}&quot;. Try a different word — for example the
                  task you want to do, like &quot;merge&quot; or &quot;compress&quot;.
                </p>
                {/* Zero-result recovery: real popular tools, not a fabricated
                    "smarter" match — the same POPULAR_TOOLS data already
                    shown in the pre-search state, so a dead-end query still
                    ends at something real and useful. */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                    Or try one of these
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {POPULAR_TOOLS.slice(0, 5).map((tool) => (
                      <Link
                        key={tool.path}
                        href={tool.path}
                        className="px-3 py-1.5 rounded-full border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      >
                        {tool.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  {results.total} result{results.total === 1 ? "" : "s"}
                </p>
                <SearchResultGroup
                  label={RESULT_TYPE_LABELS.tool}
                  entries={results.tools}
                  onResultClick={handleResultClick}
                />
                <SearchResultGroup
                  label={RESULT_TYPE_LABELS.guide}
                  entries={results.guides}
                  onResultClick={handleResultClick}
                />
                <SearchResultGroup
                  label={RESULT_TYPE_LABELS.category}
                  entries={results.categories}
                  onResultClick={handleResultClick}
                />
              </>
            )}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-24">
            {/* Popular tools */}
            <section>
              <SectionHeading
                icon={TrendingUp}
                title="Popular Tools"
                action={{ label: "Browse all categories", href: "/categories" }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {POPULAR_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Link key={tool.path} href={tool.path} className="block group">
                      <Card className="h-full border transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md group-hover:-translate-y-0.5">
                        <CardContent className="pt-6">
                          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 transition-colors group-hover:bg-primary/15">
                            <Icon className="h-5 w-5 text-primary" aria-hidden />
                          </div>
                          <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                            {tool.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">{tool.tagline}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Browse by category — where the full tool listings actually live */}
            <section>
              <SectionHeading icon={FolderOpen} title="Browse by Category" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {CATEGORY_CARDS.map((category) => {
                  const Icon = category.icon;
                  return (
                    <Link key={category.path} href={category.path} className="block group">
                      <Card className="h-full border transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md group-hover:-translate-y-0.5">
                        <CardContent className="pt-6 flex flex-col h-full">
                          <div className="flex items-center justify-between mb-4">
                            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center transition-colors group-hover:bg-primary/15">
                              <Icon className="h-5 w-5 text-primary" aria-hidden />
                            </div>
                            {category.toolCount > 0 && (
                              <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                                {category.toolCount} tool{category.toolCount === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                            {category.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4 flex-1">
                            {category.description}
                          </p>
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                            Browse
                            <ArrowRight
                              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                              aria-hidden
                            />
                          </span>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Recently added */}
            <section>
              <SectionHeading icon={Clock} title="Recently Added" />
              <div className="flex flex-wrap gap-3">
                {RECENT_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Link
                      key={tool.path}
                      href={tool.path}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm font-medium hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5 transition-all"
                    >
                      <Icon className="h-4 w-4 text-primary" aria-hidden />
                      {tool.name}
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Guides */}
            <section>
              <Link
                href="/guides"
                className="flex items-center justify-between gap-4 p-7 rounded-2xl border bg-white dark:bg-slate-900 hover:border-primary/40 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 transition-colors group-hover:bg-primary/15">
                    <BookOpen className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Guides &amp; How-Tos</h2>
                    <p className="text-sm text-muted-foreground">
                      Learn how each tool works and how to get the best results.
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0"
                  aria-hidden
                />
              </Link>
            </section>

            {/* Why PDFPilot */}
            <section>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-center mb-12">
                Why PDFPilot
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {WHY_PDFPILOT.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="text-center">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 mx-auto">
                      <Icon className="h-6 w-6 text-primary" aria-hidden />
                    </div>
                    <h3 className="font-semibold mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
