import Link from "next/link";
import { FileText } from "lucide-react";

export function Footer() {
  const tools = [
    { name: "Merge PDF", href: "/merge-pdf" },
    { name: "Split PDF", href: "/split-pdf" },
    { name: "Compress PDF", href: "/compress-pdf" },
    { name: "PDF to JPG", href: "/pdf-to-jpg" },
    { name: "JPG to PDF", href: "/jpg-to-pdf" },
  ];

  const legal = [
    { name: "About", href: "/about" },
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
  ];

  return (
    <footer className="border-t bg-white dark:bg-slate-950 py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold text-xl mb-4">
              <FileText className="h-6 w-6 text-primary" />
              <span>PDFPilot</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Free, fast, and easy-to-use PDF tools for everyone.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Tools</h3>
            <ul className="space-y-2">
              {tools.map((tool) => (
                <li key={tool.href}>
                  <Link
                    href={tool.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              {legal.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} PDFPilot. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
