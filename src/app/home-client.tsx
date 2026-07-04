"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Merge,
  Scissors,
  Zap,
} from "lucide-react";
import Link from "next/link";

const tools = [
  {
    title: "Merge PDF",
    description: "Combine multiple PDFs into one file",
    icon: Merge,
    href: "/merge-pdf",
  },
  {
    title: "Split PDF",
    description: "Extract pages from a PDF file",
    icon: Scissors,
    href: "/split-pdf",
  },
  {
    title: "Compress PDF",
    description: "Reduce file size of your PDFs",
    icon: Zap,
    href: "/compress-pdf",
  },
  {
    title: "PDF to JPG",
    description: "Convert PDF pages to images",
    icon: ImageIcon,
    href: "/pdf-to-jpg",
  },
  {
    title: "JPG to PDF",
    description: "Convert images to PDF documents",
    icon: FileText,
    href: "/jpg-to-pdf",
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
          <Link href={tools[0].href}>
            <Button size="lg" className="text-lg px-8 py-6">
              Start Using Tools
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.title} href={tool.href} className="block">
                <Card className="h-full hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>{tool.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{tool.description}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
