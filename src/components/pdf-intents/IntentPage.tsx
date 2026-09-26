import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { getArticleSchema, getBreadcrumbSchema, getFaqSchema, getSoftwareApplicationSchema, getToolSeo } from "@/lib/seo";
import { pseoMetadata } from "@/lib/content/pseo-metadata";
import { INTENT_FAMILY_LABEL, PUBLISHED_PDF_INTENTS, type PdfIntent } from "@/lib/content/pdf-intents";
import { ConnectedToolCard, IntentToolExperience, ReviewChecklist, SizePlanner } from "./IntentInteractions";
import styles from "./intent.module.css";

export function intentMetadata(page: PdfIntent): Metadata {
  const metadata = pseoMetadata(page.title, page.description, page.path, `/og/${page.tool}.png`);
  return { ...metadata, robots: { index: page.status === "published", follow: true }, ...(page.family === "guide" ? { openGraph: { ...metadata.openGraph, type: "article" } } : {}) };
}

export function IntentNavigation() {
  return <nav aria-label="PDF workflow library" className={styles.subnav}><Link href="/use-cases">PDF workflow library</Link><div><Link href="/use-cases#tools">Tools</Link><Link href="/use-cases#workflows">Workflows</Link><Link href="/use-cases#guides">Guides</Link></div></nav>;
}

export function IntentCard({ page, description = false }: { page: PdfIntent; description?: boolean }) {
  return <Link href={page.path} className={styles.relatedCard}><div><p className={styles.eyebrow}>{INTENT_FAMILY_LABEL[page.family]}</p><h3>{page.title.split(" — ")[0]}</h3>{description && <p>{page.description}</p>}</div><span className={styles.arrow} aria-hidden="true">↗</span></Link>;
}

export function IntentPage({ page }: { page: PdfIntent }) {
  const guide = page.family === "guide";
  const tool = getToolSeo(`/${page.tool}`)!;
  const related = page.related.map(id => PUBLISHED_PDF_INTENTS.find(row => row.id === id)).filter((row): row is PdfIntent => !!row);
  const toolName = page.tool === "merge-pdf" ? "Merge PDF files" : "Compress PDF files";
  const schema = [
    getBreadcrumbSchema([{ name: "Home", path: "/" }, { name: "PDF workflow library", path: "/use-cases" }, { name: page.title, path: page.path }]),
    getFaqSchema(page.faqs, "en"),
    ...(guide ? [getArticleSchema({ title: page.title, description: page.description, path: page.path })] : page.family === "tool" ? [getSoftwareApplicationSchema({ ...tool, description: page.description, inLanguage: "en" })] : [{ "@context": "https://schema.org", "@type": "WebPage", name: page.title, description: page.description, url: `https://pdfpilot.net${page.path}`, inLanguage: "en", about: { "@type": "SoftwareApplication", name: tool.name, url: `https://pdfpilot.net/${page.tool}` } }]),
  ];
  return <><JsonLd data={schema} /><IntentToolExperience key={page.id} tool={page.tool} pageId={page.id} family={page.family}><div className={styles.surface} data-intent-id={page.id}><div className={styles.wrap}>
    <IntentNavigation />
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/use-cases">Workflow library</Link><span aria-hidden="true">/</span><span>{INTENT_FAMILY_LABEL[page.family]}</span></nav>
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>{page.eyebrow}</p><h1>{page.heading}</h1><p className={styles.lead}>{page.intro}</p>
        <div className={styles.heroAction}><a className={styles.button} href={guide ? "#steps" : "#pdf-tool"}>{guide ? "Start the check" : toolName}<span aria-hidden="true">↗</span></a><a href={page.calculator ? "#size-planner" : "#checklist"}>{page.calculator ? "Calculate my size target" : "Jump to the checklist"}</a></div>
        {!guide && <p className={styles.note}>Free, local PDF processing. No account needed.</p>}
      </div>
      {guide ? <nav className={styles.toc} aria-label="On this page"><p className={styles.eyebrow}>In this guide</p><h2 style={{ marginTop: 14 }}>A clear way forward</h2><ol><li><a href="#steps">{page.stepsTitle}</a></li><li><a href="#details">The practical example</a></li><li><a href="#checklist">Your review checklist</a></li><li><a href="#questions">Common questions</a></li><li><a href="#next-step">{toolName}</a></li></ol></nav> : <ConnectedToolCard tool={page.tool} title={page.cardTitle} />}
    </header>
    <dl className={styles.facts}>{page.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className={guide ? styles.guideBody : undefined}>
      <aside className={styles.decision}><strong>{guide ? "Start with this check" : "Before you begin"}</strong><p>{page.decision}</p></aside>
      {page.calculator && <SizePlanner />}
      <section className={styles.section} id="steps"><div className={styles.sectionHead}><p className={styles.eyebrow}>{guide ? "Work through the result" : "From starting point to finished file"}</p><h2>{page.stepsTitle}</h2></div><ol className={styles.steps}>{page.steps.map((step, index) => <li key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol></section>
      <section className={styles.section} id="details"><div className={styles.sectionHead}><p className={styles.eyebrow}>Make it fit your task</p><h2>{page.detailsTitle}</h2><p>{page.detailsIntro}</p></div>
        {page.example && <div className={styles.example}><div className={styles.tableScroll}><table><caption>{page.example.caption}</caption><thead><tr>{page.example.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{page.example.rows.map((row, index) => <tr key={index}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody></table></div><p className={styles.note}>{page.example.note}</p></div>}
        {page.details.length > 0 && <div className={styles.detailGrid}>{page.details.map(detail => <div className={styles.detailCard} key={detail.title}><h3>{detail.title}</h3><p>{detail.text}</p></div>)}</div>}
      </section>
      <section className={styles.checkPanel} id="checklist"><p className={styles.eyebrow}>Final review</p><h2>{page.checklistTitle}</h2><ReviewChecklist items={page.checklist} /></section>
      <section className={`${styles.section} ${styles.faq}`} id="questions"><div className={styles.sectionHead}><p className={styles.eyebrow}>A little more clarity</p><h2>Common questions</h2></div><div>{page.faqs.map(faq => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>
    </div>
    {guide && <section className={`${styles.section} ${styles.nextTool}`} id="next-step"><div><p className={styles.eyebrow}>Put the next step into practice</p><h2 style={{ marginTop: 14 }}>{page.cardTitle}</h2><p>Use your original PDFs and the checks above. Select your files to open the working tool right here.</p></div><ConnectedToolCard tool={page.tool} title={toolName} /></section>}
    <section className={styles.section} id="related"><div className={styles.sectionHead}><p className={styles.eyebrow}>Connected workflows</p><h2>Explore related workflows</h2></div><div className={styles.relatedGrid}>{related.map(row => <IntentCard key={row.id} page={row} />)}</div></section>
  </div></div></IntentToolExperience></>;
}
