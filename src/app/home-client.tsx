"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  MonitorDown,
  Search,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { TOOLS, type Tool } from "@/lib/tools";
import { searchAll, type SearchEntry } from "@/lib/search";
import { clearRecentSearches, getRecentSearches, recordSearch } from "@/lib/recent-searches";
import { trackSearchPerformed, trackSearchResultClicked } from "@/lib/analytics/events";
import { getCategoryStyle } from "@/lib/category-colors";

interface HomeClientProps {
  searchIndex: SearchEntry[];
}

const TOOL_BY_SLUG = new Map(TOOLS.map((tool) => [tool.slug, tool]));

const CATEGORY_FILTERS = [
  { id: "all", label: "All", slugs: [] },
  {
    id: "organize",
    label: "Organize PDF",
    slugs: [
      "merge-pdf",
      "split-pdf",
      "delete-pages",
      "extract-pages",
      "rearrange-pages",
      "insert-pages",
      "duplicate-pages",
    ],
  },
  {
    id: "optimize",
    label: "Optimize PDF",
    slugs: ["compress-pdf", "ocr-pdf", "flatten-pdf", "compare-pdf"],
  },
  {
    id: "convert",
    label: "Convert PDF",
    slugs: [
      "pdf-to-jpg",
      "jpg-to-pdf",
      "word-to-pdf",
      "pdf-to-word",
      "powerpoint-to-pdf",
      "pdf-to-powerpoint",
      "excel-to-pdf",
      "pdf-to-excel",
      "txt-to-pdf",
      "markdown-to-pdf",
      "csv-to-pdf",
      "svg-to-pdf",
    ],
  },
  {
    id: "edit",
    label: "Edit PDF",
    slugs: [
      "edit-pdf",
      "rotate-pdf",
      "watermark-pdf",
      "crop-pdf",
      "fill-pdf",
      "add-page-numbers",
      "pdf-metadata-editor",
    ],
  },
  {
    id: "security",
    label: "PDF Security",
    slugs: ["lock-pdf", "unlock-pdf"],
  },
  {
    id: "intelligence",
    label: "PDF Intelligence",
    slugs: ["summary-generator", "ocr-image", "pdf-to-markdown"],
  },
] as const;

const FEATURED_SLUGS = [
  "merge-pdf",
  "split-pdf",
  "compress-pdf",
  "pdf-to-word",
  "pdf-to-powerpoint",
  "pdf-to-excel",
  "word-to-pdf",
  "powerpoint-to-pdf",
  "excel-to-pdf",
  "edit-pdf",
  "pdf-to-jpg",
  "jpg-to-pdf",
  "rotate-pdf",
  "watermark-pdf",
  "unlock-pdf",
  "lock-pdf",
  "ocr-pdf",
  "compare-pdf",
  "summary-generator",
  "flatten-pdf",
  "crop-pdf",
  "fill-pdf",
  "add-page-numbers",
  "delete-pages",
  "extract-pages",
  "rearrange-pages",
  "insert-pages",
  "duplicate-pages",
] as const;

const FEATURED_TOOLS = FEATURED_SLUGS.map((slug) => TOOL_BY_SLUG.get(slug)).filter(
  (tool): tool is Tool => tool !== undefined
);

const ALL_FILTERED_TOOLS = [
  ...FEATURED_TOOLS,
  ...TOOLS.filter((tool) => !FEATURED_TOOLS.includes(tool)),
];

const RESULT_TYPE_LABELS: Record<SearchEntry["type"], string> = {
  tool: "Tools",
  guide: "Guides",
  category: "Categories",
};

const HOME_ICON_COLORS: Record<string, { background: string; color: string }> = {
  organize: { background: "#fee2d5", color: "#f26f4f" },
  optimize: { background: "#e3f4d4", color: "#78b84f" },
  convert: { background: "#fff3b8", color: "#e4bd12" },
  "convert-alt": { background: "#dce8ff", color: "#4f7fca" },
  edit: { background: "#efd9ea", color: "#af649d" },
  security: { background: "#dce8ff", color: "#4f7fca" },
  ai: { background: "#e7dcff", color: "#7c4fe0" },
};

function ToolGlyph({ tool, size = "lg" }: { tool: Tool; size?: "sm" | "lg" }) {
  const Icon = tool.icon ?? FileText;
  const iconStyle = getCategoryStyle(tool);
  const colors = HOME_ICON_COLORS[iconStyle.label] ?? HOME_ICON_COLORS.organize;
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${
        size === "lg" ? "h-14 w-14" : "h-8 w-8"
      }`}
      style={{ backgroundColor: colors.background, color: colors.color }}
      aria-hidden
    >
      <Icon className={size === "lg" ? "h-7 w-7" : "h-4 w-4"} />
    </span>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link
      href={tool.path}
      className="group block h-full rounded-lg border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-400 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
    >
      <ToolGlyph tool={tool} />
      <h3 className="mt-7 text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-red-600 dark:text-white">
        {tool.name}
      </h3>
      <p className="mt-3 min-h-[4.75rem] text-[15px] leading-6 text-slate-600 dark:text-slate-300">
        {tool.tagline}
      </p>
    </Link>
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
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li key={entry.path}>
            <Link
              href={entry.path}
              onClick={() => onResultClick?.(entry)}
              className="group flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-slate-800 dark:bg-slate-900"
            >
              <span>
                <span className="block font-semibold text-slate-900 group-hover:text-red-600 dark:text-white">
                  {entry.name}
                </span>
                <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                  {entry.description}
                </span>
              </span>
              <ArrowRight
                className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-red-600"
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
  const [activeFilter, setActiveFilter] = useState<(typeof CATEGORY_FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchAll(searchIndex, query), [searchIndex, query]);
  const isSearching = query.trim().length > 0;

  const visibleTools = useMemo(() => {
    const filter = CATEGORY_FILTERS.find((item) => item.id === activeFilter);
    if (!filter || filter.id === "all") return FEATURED_TOOLS;
    const allowed = new Set<string>(filter.slugs);
    return ALL_FILTERED_TOOLS.filter((tool) => allowed.has(tool.slug));
  }, [activeFilter]);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const timeout = setTimeout(() => {
      trackSearchPerformed(trimmed, results.total);
    }, 600);
    return () => clearTimeout(timeout);
  }, [query, results.total]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleResultClick = (entry: SearchEntry) => {
    recordSearch(query);
    setRecentSearches(getRecentSearches());
    trackSearchResultClicked(query, entry.type, entry.path);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
    }
  };

  const handleClearRecentSearches = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  return (
    <main className="flex-1 bg-[#f7f7fb] text-slate-900 dark:bg-slate-950 dark:text-white">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[#f7f7fb] dark:border-slate-800 dark:bg-slate-950">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-[linear-gradient(135deg,rgba(239,68,68,0.08),transparent_65%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(225deg,rgba(245,158,11,0.09),transparent_68%)]"
          aria-hidden
        />

        <div className="container relative mx-auto px-4 pb-10 pt-14 md:pb-12 md:pt-20">
          <div className="mx-auto max-w-5xl text-center">
            <h1 className="text-balance text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl dark:text-white">
              Every PDF tool you need in one simple place
            </h1>
            <p className="mx-auto mt-5 max-w-4xl text-pretty text-lg leading-8 text-slate-600 md:text-2xl dark:text-slate-300">
              Merge, split, compress, convert, edit and secure PDFs for free. No sign-up,
              no watermarks, and files stay in your browser.
            </p>

            <div className="mx-auto mt-8 max-w-2xl">
              <div className="relative">
                <Search
                  className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search tools..."
                  aria-label="Search tools"
                  className="h-14 w-full rounded-full border border-slate-200 bg-white pl-12 pr-5 text-base shadow-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 dark:border-slate-800 dark:bg-slate-900 dark:focus:ring-red-950"
                />
              </div>
              {!isSearching && recentSearches.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Recent</span>
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setQuery(term)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    >
                      {term}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClearRecentSearches}
                    className="text-xs font-medium text-slate-500 underline underline-offset-4 hover:text-slate-900 dark:hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {!isSearching && (
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                {CATEGORY_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={`rounded-full border px-5 py-2.5 text-sm font-bold transition-all ${
                      activeFilter === filter.id
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-950"
                        : "border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-slate-400 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-9 md:py-12">
        {isSearching ? (
          <div className="mx-auto max-w-3xl space-y-10" role="region" aria-live="polite">
            {results.total === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-slate-600 dark:text-slate-300">
                  No results for &ldquo;{query}&rdquo;. Try a task name like merge, compress, convert, or
                  unlock.
                </p>
              </div>
            ) : (
              <>
                <p className="text-center text-sm font-medium text-slate-500">
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {visibleTools.map((tool) => (
              <ToolCard key={tool.path} tool={tool} />
            ))}
          </div>
        )}
      </section>

      {!isSearching && (
        <>
          <section className="bg-white py-16 dark:bg-slate-950">
            <div className="container mx-auto px-4">
              <h2 className="text-center text-4xl font-extrabold tracking-tight">
                Work your way
              </h2>
              <div className="mt-10 grid gap-6 lg:grid-cols-3">
                {[
                  {
                    icon: MonitorDown,
                    title: "Fast on desktop",
                    body: "Drop large files, sort them, and finish the task without account friction.",
                  },
                  {
                    icon: Smartphone,
                    title: "Simple on mobile",
                    body: "The important action stays obvious, even on a small screen.",
                  },
                  {
                    icon: BriefcaseBusiness,
                    title: "Ready for real work",
                    body: "100MB files, batch workflows, and browser-only processing make it practical.",
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <div
                    key={title}
                    className="rounded-lg border border-slate-200 bg-[#fff4ee] p-8 shadow-[0_12px_30px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900"
                  >
                    <Icon className="h-9 w-9 text-red-600" aria-hidden />
                    <h3 className="mt-14 text-2xl font-bold tracking-tight">{title}</h3>
                    <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="container mx-auto px-4 py-16">
            <div className="grid items-center gap-10 rounded-lg bg-[#fff2c9] p-8 md:grid-cols-[1.05fr_0.95fr] md:p-14 dark:bg-slate-900">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
                  Built around fewer clicks
                </h2>
                <div className="mt-8 space-y-5 text-lg text-slate-700 dark:text-slate-300">
                  {[
                    "Upload once and move straight into the tool.",
                    "Important tools support batches and clear file ordering.",
                    "Downloads are designed to happen automatically after processing.",
                  ].map((item) => (
                    <p key={item} className="flex gap-3">
                      <CheckCircle2
                        className="mt-1 h-6 w-6 shrink-0 text-emerald-600"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-lg bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.14)] dark:bg-slate-950">
                <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
                  <div className="mb-6 flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Trust layer
                    </span>
                    <ShieldCheck className="h-6 w-6 text-emerald-600" aria-hidden />
                  </div>
                  <p className="text-2xl font-bold">Secure. Private. In your control.</p>
                  <p className="mt-4 text-slate-600 dark:text-slate-300">
                    Files are processed locally in the browser whenever the tool supports it, so
                    the page stays focused on getting the job done.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
