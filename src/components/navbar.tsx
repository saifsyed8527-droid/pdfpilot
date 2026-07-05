"use client";
import Link from "next/link";
import { FileText, Menu, X } from "lucide-react";
import { useState } from "react";
import { TOOLS } from "@/lib/tools";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav aria-label="Main" className="border-b bg-white dark:bg-slate-950 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-xl">
            <FileText className="h-6 w-6 text-primary" />
            <span>PDFPilot</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {TOOLS.map((tool) => (
              <Link
                key={tool.path}
                href={tool.path}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {tool.name}
              </Link>
            ))}
            <div className="flex items-center gap-4">
              <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">
                About
              </Link>
            </div>
          </div>

          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden pb-4 border-t">
            <div className="flex flex-col gap-3 pt-4">
              {TOOLS.map((tool) => (
                <Link
                  key={tool.path}
                  href={tool.path}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {tool.name}
                </Link>
              ))}
              <Link
                href="/about"
                className="text-sm text-muted-foreground hover:text-foreground"
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
