"use client";
import { useResourceI18n } from "@/components/i18n/ResourceLocaleProvider";
import dynamic from "next/dynamic";
import type { ConversionTemplate } from "@/lib/content/conversion-templates";
function Loading() { const { t: tr } = useResourceI18n(); return <p role="status" className="p-8 text-center">{tr("Loading the local converter…")}</p>; }
const Jpg = dynamic(() => import("@/app/jpg-to-pdf/jpg-to-pdf-client").then(m => m.JpgToPdfClient), { loading: Loading });
const Word = dynamic(() => import("@/app/word-to-pdf/word-to-pdf-client").then(m => m.WordToPdfClient), { loading: Loading });
const Powerpoint = dynamic(() => import("@/app/powerpoint-to-pdf/powerpoint-to-pdf-client").then(m => m.PowerpointToPdfClient), { loading: Loading });

export function ConversionTemplateRunner({ template }: { template: ConversionTemplate }) {
  const { t: tr } = useResourceI18n();

  const session = { samples: template.samples, preset: template.preset };
  return <div data-template-runner={template.tool} data-template-preset={JSON.stringify(template.preset ?? null)}>
    {tr(template.tool === "jpg-to-pdf" ? <Jpg key={template.path} templateSession={session} /> : template.tool === "word-to-pdf" ? <Word key={template.path} templateSession={session} /> : <Powerpoint key={template.path} templateSession={session} />)}
  </div>;
}
