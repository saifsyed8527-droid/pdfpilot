import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";
import { TOOLS } from "@/lib/tools";
import { CATEGORIES, type CategoryEntity } from "@/lib/content/categories";

/**
 * Footer link budget: every column is capped so the footer stays small no
 * matter how many tools exist. Full tool discovery lives in the mega menu,
 * homepage search, and category pages — never here.
 */
const MAX_LINKS_PER_COLUMN = 5;

// "Popular" derives from the registry's curated `order` field (the
// deliberate flagship-first ranking) — not from usage data, which doesn't
// exist yet. When real analytics exist, only this line changes.
const POPULAR_TOOLS = [...TOOLS]
  .sort((a, b) => a.order - b.order)
  .slice(0, MAX_LINKS_PER_COLUMN);

const FOOTER_CATEGORY_SLUGS = [
  "optimize",
  "merge-pdf-tools",
  "split-pdf-tools",
  "pdf-to-jpg-tools",
  "jpg-to-pdf-tools",
];

const FOOTER_CATEGORIES = FOOTER_CATEGORY_SLUGS
  .map((slug) => CATEGORIES.find((c) => c.slug === slug))
  .filter(Boolean) as readonly CategoryEntity[];

const COLUMNS: { heading: string; links: { name: string; href: string }[] }[] = [
  {
    heading: "Popular Tools",
    links: POPULAR_TOOLS.map((tool) => ({ name: tool.name, href: tool.path })),
  },
  {
    heading: "Categories",
    links: FOOTER_CATEGORIES.map((category) => ({
      name: category.title,
      href: category.path,
    })),
  },
  {
    heading: "Resources",
    links: [
      { name: "Guides", href: "/guides" },
      { name: "All Categories", href: "/categories" },
    ],
  },
  {
    heading: "Company",
    links: [{ name: "About", href: "/about" }],
  },
  {
    heading: "Legal",
    links: [
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Terms of Service", href: "/terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t bg-white dark:bg-slate-950 pt-16 pb-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-x-6 gap-y-10">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 font-semibold text-xl mb-4">
              <FileText className="h-6 w-6 text-primary" aria-hidden />
              <span>PDFPilot</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-xs">
              Every tool you need to work with PDFs — free, fast, and in your browser.
            </p>
            <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              Your files never leave your device.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
                {column.heading}
              </h3>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t mt-14 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>© 2026 PDFPilot. All rights reserved.</p>
          <p className="text-xs">Files processed entirely in your browser.</p>
        </div>
      </div>
    </footer>
  );
}
