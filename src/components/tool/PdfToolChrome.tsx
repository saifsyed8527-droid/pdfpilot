"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Plus, ShieldCheck, Upload } from "lucide-react";
import { useDropzone, type Accept, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { TrustSection } from "@/components/tool/TrustSection";
import { getCrossSellTools } from "@/lib/cross-sell";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

type Accent = "amber" | "orange" | "emerald";

const ACCENTS: Record<Accent, { glow: string; border: string; button: string; darkButton: string }> = {
  amber: {
    glow: "rgba(251,191,36,0.13)",
    border: "border-amber-500 bg-amber-50 dark:bg-amber-950/20",
    button: "hover:border-amber-400 focus-visible:ring-amber-500",
    darkButton: "dark:bg-amber-500 dark:text-slate-950",
  },
  orange: {
    glow: "rgba(249,115,22,0.12)",
    border: "border-orange-500 bg-orange-50 dark:bg-orange-950/20",
    button: "hover:border-orange-400 focus-visible:ring-orange-500",
    darkButton: "dark:bg-orange-500 dark:text-white",
  },
  emerald: {
    glow: "rgba(16,185,129,0.12)",
    border: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20",
    button: "hover:border-emerald-400 focus-visible:ring-emerald-500",
    darkButton: "dark:bg-emerald-500 dark:text-slate-950",
  },
};

export function PdfToolLanding({
  title,
  description,
  buttonLabel,
  dropLabel,
  limitLabel,
  accept,
  multiple,
  icon: Icon,
  iconClass,
  iconBackgroundClass,
  accent,
  onFilesSelected,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  dropLabel: string;
  limitLabel: string;
  accept: Accept;
  multiple: boolean;
  icon: LucideIcon;
  iconClass: string;
  iconBackgroundClass: string;
  accent: Accent;
  onFilesSelected: (files: File[]) => void;
}) {
  const colors = ACCENTS[accent];
  const onRejected = (rejections: FileRejection[]) => {
    const tooLarge = rejections.some((rejection) => rejection.errors.some((error) => error.code === "file-too-large"));
    toast.error(tooLarge ? "Each file must be 100MB or smaller." : "Please choose a supported file.");
  };
  const dropzone = useDropzone({ accept, multiple, maxSize: MAX_FILE_SIZE, onDropAccepted: onFilesSelected, onDropRejected: onRejected });

  return (
    <div
      className="flex flex-1 py-10 dark:bg-slate-950/50 md:py-14"
      style={{ backgroundImage: `radial-gradient(circle at 50% 18%, ${colors.glow}, transparent 34%), linear-gradient(to bottom, #f8fafc, #ffffff)` }}
    >
      <div className="container mx-auto flex max-w-5xl flex-1 flex-col px-4">
        <BackToHome />
        <section className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
          <div className={cn("mb-5 flex h-16 w-16 items-center justify-center rounded-2xl", iconBackgroundClass)}>
            <Icon className={cn("h-8 w-8", iconClass)} aria-hidden />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">{description}</p>
          <div
            {...dropzone.getRootProps({ role: "button", "aria-label": `${buttonLabel}, or drop files here` })}
            className={cn(
              "mt-9 w-full max-w-xl cursor-pointer rounded-3xl border-2 border-dashed bg-white p-5 shadow-[0_22px_70px_-46px_rgba(15,23,42,0.55)] transition focus-visible:outline-none focus-visible:ring-2 dark:bg-slate-900",
              dropzone.isDragActive ? colors.border : cn("border-slate-200", colors.button)
            )}
          >
            <input {...dropzone.getInputProps()} />
            <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl bg-slate-50 px-5 py-8 dark:bg-slate-950/60">
              <span className={cn("inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-slate-950 px-7 py-4 text-base font-semibold text-white shadow-lg md:text-lg", colors.darkButton)}>
                <Upload className="h-5 w-5" aria-hidden />
                {dropzone.isDragActive ? "Drop files here" : buttonLabel}
              </span>
              <span className="mt-4 text-sm text-slate-500">{dropLabel}</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden /> Files stay on your device</span>
            <span>{limitLabel}</span>
            <span>No account needed</span>
          </div>
        </section>
      </div>
    </div>
  );
}

export function BackToHome() {
  return (
    <Link href="/" className="mb-7 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Home
    </Link>
  );
}

export function PdfWorkspaceBar({ title, meta, actions }: { title: string; meta: ReactNode; actions?: ReactNode }) {
  return (
    <div className="border-b bg-white/95 dark:bg-slate-900/95">
      <div className="container mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Back to Home">
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight">{title}</h1>
            <div className="text-xs text-slate-500" aria-live="polite">{meta}</div>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PdfAddButton({ count, label, accent, disabled, onClick }: { count?: number; label: string; accent: Accent; disabled?: boolean; onClick: () => void }) {
  const hover = accent === "emerald" ? "hover:bg-emerald-500" : accent === "orange" ? "hover:bg-orange-500" : "hover:bg-amber-500";
  const ring = accent === "emerald" ? "focus-visible:ring-emerald-500" : accent === "orange" ? "focus-visible:ring-orange-500" : "focus-visible:ring-amber-500";
  return (
    <div className="group/add relative">
      <button type="button" onClick={onClick} disabled={disabled} className={cn("relative flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 motion-reduce:hover:translate-y-0", hover, ring)} aria-label={label}>
        <Plus className="h-6 w-6" aria-hidden />
        {typeof count === "number" && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-slate-950 ring-2 ring-slate-950">{count}</span>}
      </button>
      <span className="pointer-events-none absolute right-0 top-14 z-30 whitespace-nowrap rounded bg-slate-950 px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover/add:opacity-100 group-focus-within/add:opacity-100">{label}</span>
    </div>
  );
}

export function PdfToolResultLayout({ toolSlug, children }: { toolSlug: string; children: ReactNode }) {
  return (
    <div className="flex-1 bg-slate-50/70 py-10 dark:bg-slate-950/40 md:py-14">
      <div className="container mx-auto max-w-4xl px-4">
        <BackToHome />
        <section className="rounded-3xl border bg-white px-5 py-8 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.5)] dark:bg-slate-900 md:px-10">
          {children}
        </section>
        <RelatedTools title="Continue with your PDF" tools={getCrossSellTools(toolSlug)} />
        <TrustSection />
      </div>
    </div>
  );
}
