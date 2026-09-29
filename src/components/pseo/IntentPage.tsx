import Link from "next/link";
import type { PseoPage } from "@/lib/pseo/schema";
import { CAPABILITY_BY_ID, privacyCopy } from "@/lib/pseo/capabilities";
import { getPseoPage } from "@/lib/pseo/registry";
import { intentSchema } from "@/lib/pseo/metadata";
import { IntentPresentation } from "./IntentPresentation";
import { TrackIntent } from "./TrackIntent";
import { IntentTool } from "@/lib/pseo/workspaces";

export async function IntentPage({ page }: { page: PseoPage }) {
  const tool = CAPABILITY_BY_ID.get(page.baseToolId)!;
  const privacy = privacyCopy(page.baseToolId);
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(intentSchema(page)).replace(/</g, "\\u003c") }} />
    <TrackIntent pageId={page.id} baseTool={page.baseToolId} intentType={page.pageType} intentCluster={page.intentCluster} sourceMarkets={[...new Set(page.provenance.map(p=>p.sourceMarket))]} />
    <IntentPresentation title={page.h1} description={page.subtitle} privacy={privacy}>
      <IntentTool toolId={page.baseToolId} faqs={page.faqItems} related={[]} {...(page.baseToolId === "jpg-to-pdf" ? { landingCopy: { title: page.h1, description: page.subtitle, buttonLabel: "Select JPG or PNG images", dropLabel: "or drag and drop JPG or PNG files here", limitLabel: "100MB max per image" } } : {})} />
    </IntentPresentation>
    <div className="container mx-auto max-w-5xl space-y-9 px-4 py-10">
      <section><h2 className="text-2xl font-semibold">How to complete this task</h2><ol className="mt-4 list-decimal space-y-3 ps-5">{page.howToSteps.map(step=><li key={step}>{step}</li>)}</ol></section>
      <section><h2 className="text-2xl font-semibold">What to check for this task</h2>{page.useCaseContent.map(p=><p key={p} className="mt-4 leading-relaxed text-muted-foreground">{p}</p>)}</section>
      {!!page.compatibilityContent.length && <section><h2 className="text-xl font-semibold">Compatibility</h2>{page.compatibilityContent.map(p=><p key={p} className="mt-3 text-muted-foreground">{p}</p>)}</section>}
      <section><h2 className="text-xl font-semibold">Processing and privacy</h2><p className="mt-3 text-muted-foreground">{privacy}</p></section>
      <section><h2 className="text-xl font-semibold">Limitations</h2>{page.limitationsContent.map(p=><p key={p} className="mt-3 text-muted-foreground">{p}</p>)}</section>
      {!!page.faqItems.length && <section><h2 className="text-xl font-semibold">Questions about this task</h2><dl className="mt-4 space-y-5">{page.faqItems.map(f=><div key={f.question}><dt className="font-semibold">{f.question}</dt><dd className="mt-2 text-muted-foreground">{f.answer}</dd></div>)}</dl></section>}
      <nav aria-label="Related PDF tasks"><h2 className="text-xl font-semibold">Related tasks</h2><ul className="mt-4 space-y-3"><li><Link className="underline" href={`/${tool.canonicalSlug}`}>{tool.displayName}</Link></li>{page.relatedPages.map(slug=>{const related=getPseoPage(slug);return related?<li key={slug}><Link className="underline" href={`/${slug}`}>{related.h1}</Link></li>:null;})}<li><Link className="underline" href="/pdf-workflows">Browse PDF tasks and workflows</Link></li></ul></nav>
    </div>
  </>;
}
