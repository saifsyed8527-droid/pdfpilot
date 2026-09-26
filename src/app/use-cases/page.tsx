import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { IntentCard, IntentNavigation } from "@/components/pdf-intents/IntentPage";
import styles from "@/components/pdf-intents/intent.module.css";
import { PUBLISHED_PDF_INTENTS } from "@/lib/content/pdf-intents";
import { pseoMetadata, collectionSchema } from "@/lib/content/pseo-metadata";

export const metadata = pseoMetadata("PDF Workflows — Tools, Upload Tasks & Practical Guides", "Find the right PDF workflow: compress for an upload limit, merge an application packet, or check a finished file. Working tools, size planner and review checklists.", "/use-cases");

export default function WorkflowLibrary() {
  return <div className={styles.surface}><JsonLd data={collectionSchema("PDF workflow library", "/use-cases", PUBLISHED_PDF_INTENTS)} /><div className={styles.wrap}>
    <IntentNavigation />
    <header className={styles.libraryHero}><p className={styles.eyebrow}>PDF Pilot / Workflow library</p><h1>{"One place.\nDifferent PDF jobs."}</h1><p className={styles.lead}>Start with the task in front of you. Find a working tool, follow the steps, and check the result before you send it.</p><nav aria-label="Browse workflow types" className={styles.libraryNav}><a href="#tools">PDF tools ↗</a><a href="#workflows">Specific tasks ↗</a><a href="#guides">Practical guides ↗</a></nav></header>
    {([{ id: "tools", family: "tool", title: "Start with a PDF tool", intro: "Pick your files and get to work. Review the output with a clear checklist." }, { id: "workflows", family: "task", title: "Follow a workflow for your task", intro: "An upload limit or an application packet needs a few decisions of its own." }, { id: "guides", family: "guide", title: "Find a clear next step", intro: "Understand a result, resolve a problem, or give your finished file one final check." }] as const).map(group => <section className={styles.section} id={group.id} key={group.id}><div className={styles.sectionHead}><p className={styles.eyebrow}>{group.id}</p><h2>{group.title}</h2><p>{group.intro}</p></div><div className={styles.libraryGrid}>{PUBLISHED_PDF_INTENTS.filter(page => page.family === group.family).map(page => <IntentCard key={page.id} page={page} description />)}</div></section>)}
    <section className={styles.section}><div className={styles.sectionHead}><p className={styles.eyebrow}>More ways to work</p><h2>Have another PDF job?</h2></div><div className={styles.relatedGrid}><Link className={styles.relatedCard} href="/templates/conversions">Choose a conversion preset <span aria-hidden="true">↗</span></Link><Link className={styles.relatedCard} href="/pdf-workflows">Run a two-step PDF workflow <span aria-hidden="true">↗</span></Link><Link className={styles.relatedCard} href="/">Explore all PDF tools <span aria-hidden="true">↗</span></Link></div></section>
  </div></div>;
}
