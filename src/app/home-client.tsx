"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Ban,
  BookOpen,
  Clock,
  FolderOpen,
  Search,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { TOOLS, type Tool } from "@/lib/tools";
import { CATEGORIES } from "@/lib/content/categories";
import { searchAll, type SearchEntry } from "@/lib/search";
import { getRecentSearches, recordSearch, clearRecentSearches } from "@/lib/recent-searches";
import { trackSearchPerformed, trackSearchResultClicked } from "@/lib/analytics/events";
import { getCategoryStyle } from "@/lib/category-colors";

interface HomeClientProps {
  searchIndex: SearchEntry[];
}

const TOOLS_BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

const POPULAR_TOOL_SLUGS = [
  "merge-pdf",
  "split-pdf",
  "compress-pdf",
  "pdf-to-jpg",
  "jpg-to-pdf",
  "rotate-pdf",
];

const POPULAR_TOOLS = POPULAR_TOOL_SLUGS
  .map((slug) => TOOLS.find((t) => t.slug === slug))
  .filter((t): t is Tool => t !== undefined);

const QUICK_ACTIONS = POPULAR_TOOLS.slice(0, 4);

// Explicit, hand-maintained list (same pattern as POPULAR_TOOL_SLUGS above)
// rather than derived from `order` — `order` is a curated display-priority
// ranking (flagship tools first), not a chronological signal, so sorting by
// it doesn't actually surface what was added most recently. This list
// reflects real git history (`git log --diff-filter=A -- <route>/page.tsx`),
// newest first.
const RECENT_TOOL_SLUGS = ["unlock-pdf", "summary-generator", "lock-pdf", "edit-pdf"];

const RECENT_TOOLS = RECENT_TOOL_SLUGS
  .map((slug) => TOOLS.find((t) => t.slug === slug))
  .filter((t): t is Tool => t !== undefined);

const CATEGORY_TITLES = [
  "Compress & Optimize PDFs",
  "Merge PDF Tools",
  "Split PDF Tools",
  "PDF to JPG Tools",
  "JPG to PDF Tools",
  "PDF Editing Tools",
  "Document Conversion Tools",
  "Data Conversion Tools",
];

const CATEGORY_CARDS = CATEGORY_TITLES.map((title) => {
  const category = CATEGORIES.find((c) => c.title === title);
  if (!category) return null;
  const containedTools = category.contains
    .filter((ref) => ref.type === "tool")
    .map((ref) => TOOLS_BY_ID.get(ref.id))
    .filter((tool): tool is Tool => tool !== undefined);
  const firstTool = containedTools[0];
  const style = firstTool ? getCategoryStyle(firstTool) : null;
  return {
    path: category.path,
    title: category.title,
    description: category.description,
    toolCount: containedTools.length,
    icon: firstTool?.icon ?? FolderOpen,
    style,
  };
}).filter((c): c is NonNullable<typeof c> => c !== null);

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
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-8">
      <Icon className="h-5 w-5 text-primary" aria-hidden />
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
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

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const handleResultClick = (entry: SearchEntry) => {
    recordSearch(query);
    setRecentSearches(getRecentSearches());
    trackSearchResultClicked(query, entry.type, entry.path);
  };

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
    <div className="flex-1 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4 pt-16 pb-24 md:pt-24">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Every tool you need to work with PDFs
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Merge, split, compress, convert — instantly, right in your browser.
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

          {!isSearching && (
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              {QUICK_ACTIONS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.path}
                    href={tool.path}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {tool.name}
                  </Link>
                );
              })}
            </div>
          )}

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

        {isSearching ? (
          <div className="max-w-2xl mx-auto space-y-10" role="region" aria-live="polite">
            {results.total === 0 ? (
              <div className="text-center py-12 space-y-6">
                <p className="text-muted-foreground">
                  Nothing matches &quot;{query}&quot;. Try a different word — for example the
                  task you want to do, like &quot;merge&quot; or &quot;compress&quot;.
                </p>
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
            <section>
              <SectionHeading icon={TrendingUp} title="Popular Tools" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {POPULAR_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  const style = getCategoryStyle(tool);
                  return (
                    <Link key={tool.path} href={tool.path} className="block group">
                      <Card className="h-full border bg-white dark:bg-slate-900 rounded-xl shadow-tool-card transition-all duration-200 group-hover:shadow-tool-card-hover group-hover:border-primary/40 group-hover:-translate-y-0.5">
                        <CardContent className="pt-6">
                          <div className={`w-11 h-11 rounded-2xl ${style.bgClass} flex items-center justify-center mb-4`}>
                            <Icon className={`h-5 w-5 ${style.iconClass}`} aria-hidden />
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

            <section>
              <SectionHeading icon={FolderOpen} title="Browse by Category" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {CATEGORY_CARDS.map((category) => {
                  const Icon = category.icon;
                  const style = category.style;
                  return (
                    <Link key={category.path} href={category.path} className="block group">
                      <Card className="h-full border bg-white dark:bg-slate-900 rounded-xl transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-tool-card-hover group-hover:-translate-y-0.5">
                        <CardContent className="pt-6 flex flex-col h-full">
                          <div className="flex items-start justify-between mb-4">
                            <div className={`w-11 h-11 rounded-2xl ${style?.bgClass ?? "bg-primary/10"} flex items-center justify-center`}>
                              <Icon className={`h-5 w-5 ${style?.iconClass ?? "text-primary"}`} aria-hidden />
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

            <section>
              <SectionHeading icon={Clock} title="Recently Added" />
              <div className="flex flex-wrap gap-3">
                {RECENT_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Link
                      key={tool.path}
                      href={tool.path}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm font-medium hover:border-primary/40 hover:shadow-tool-card-hover hover:-translate-y-0.5 transition-all"
                    >
                      <Icon className="h-4 w-4 text-primary" aria-hidden />
                      {tool.name}
                    </Link>
                  );
                })}
              </div>
            </section>

            <section>
              <Link
                href="/guides"
                className="flex items-center justify-between gap-4 p-7 rounded-xl border bg-white dark:bg-slate-900 hover:border-primary/40 hover:shadow-tool-card-hover transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
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

            <section>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-center mb-12">
                Why PDFPilot
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {WHY_PDFPILOT.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 mx-auto">
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
