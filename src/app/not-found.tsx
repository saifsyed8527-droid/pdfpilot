import type { Metadata } from "next";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Page Not Found | PDFPilot",
  description: "The page you're looking for doesn't exist.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <FileQuestion className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl">Page Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-8">
            <p className="text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist or may have been moved.
            </p>

            <Button size="lg" asChild>
              <Link href="/">Back to Home</Link>
            </Button>

            <div className="pt-4 border-t">
              <h2 className="text-sm font-semibold mb-4">Or jump straight to a tool</h2>
              <nav aria-label="PDF tools" className="flex flex-wrap justify-center gap-3">
                {TOOLS.map((tool) => (
                  <Link
                    key={tool.path}
                    href={tool.path}
                    className="inline-block py-1 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    {tool.name}
                  </Link>
                ))}
              </nav>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
