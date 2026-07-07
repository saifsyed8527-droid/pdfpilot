"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, ShieldCheck, Zap, Ban } from "lucide-react";
import Link from "next/link";
import { TOOLS } from "@/lib/tools";

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

export function HomeClient() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 md:py-24">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-2 mb-4">
            <FileSpreadsheet className="h-12 w-12 text-primary" />
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              PDFPilot
            </h1>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Free PDF Tools for Everyone
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Merge, split, compress and convert PDFs instantly. No sign-up required.
          </p>
          <Link href={TOOLS[0].path}>
            <Button size="lg" className="text-lg px-8 py-6">
              Start Using Tools
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.path} href={tool.path} className="block">
                <Card className="h-full hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>{tool.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{tool.tagline}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="max-w-5xl mx-auto mt-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
            Why PDFPilot
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {WHY_PDFPILOT.map(({ icon: Icon, title, body }) => (
              <div key={title} className="text-center">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
