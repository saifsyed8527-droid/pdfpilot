import Link from 'next/link';
import { CAPABILITY_BY_ID } from '@/lib/pseo/capabilities';
import { getToolIntents } from '@/lib/pseo/registry';
import { JsonLd } from './JsonLd';
import { getFaqSchema } from '@/lib/seo/faq';
import { CORE_COPY, getCorePageKeyFromPath, getLocalizedToolContent } from '@/lib/i18n/core-content';
import { localizedToolPath } from '@/lib/i18n/url-strategy';
import type { LocaleCode } from '@/lib/i18n/locales';
import portuguese from '@/lib/content/pt-br-tool-help.json';

/** Supporting content stays server rendered, below the unchanged workspace. */
export function CoreToolHelp({ toolId, locale = 'en' }: { toolId: string; locale?: LocaleCode }) {
 const tool=CAPABILITY_BY_ID.get(toolId); if(!tool)return null;
 const pt=locale==='pt-BR'?portuguese[toolId as keyof typeof portuguese]:undefined;
 const key=getCorePageKeyFromPath('/'+tool.canonicalSlug);
 if(locale!=='en'&&!pt){
  if(!key||key==='home')return null;
  const copy=getLocalizedToolContent(locale,key),common=CORE_COPY[locale].common;
  return <section lang={locale} className="container mx-auto max-w-5xl space-y-6 px-4 py-10"><h2 className="text-2xl font-semibold">{common.how}</h2><ol className="list-decimal space-y-3 ps-5">{copy.steps.map(s=><li key={s}>{s}</li>)}</ol><h2 className="text-xl font-semibold">{common.faq}</h2><dl className="space-y-4">{copy.faqs.map(f=><div key={f.question}><dt className="font-semibold">{f.question}</dt><dd>{f.answer}</dd></div>)}</dl></section>;
 }
 const faqs=pt?[{question:'Como meus arquivos são processados?',answer:pt.privacy},{question:'Quais limitações devo verificar?',answer:pt.limitation}]:[{question:'How are my files processed?',answer:tool.privacyFacts.join(' ')},{question:'What limitations should I check?',answer:tool.limitations.join(' ')}];
 const steps=pt?.steps??tool.howToSteps;
 const children=getToolIntents(toolId,12,locale).filter(p=>p.language===locale);
 return <section lang={locale} className="container mx-auto max-w-5xl space-y-7 px-4 py-10" aria-label={pt?'Ajuda da ferramenta':'Tool help'}>
  <h2 className="text-2xl font-semibold">{pt?`Como usar: ${pt.heading}`:`How to use ${tool.displayName}`}</h2>
  {pt?<><p className="leading-relaxed">{pt.description}</p><p className="leading-relaxed">{pt.guidance}</p></>:<><p className="leading-relaxed">{tool.facts.join(' ')}</p><p className="text-sm text-muted-foreground">Input: {tool.supportedInputTypes.join(', ')}. Output: {tool.supportedOutputTypes.join(', ')}.</p></>}
  <ol className="list-decimal space-y-3 ps-5">{steps.map(s=><li key={s}>{s}</li>)}</ol>
  <h2 className="text-xl font-semibold">{pt?'Privacidade e limitações':'Processing, privacy and limitations'}</h2>
  <dl className="space-y-4">{faqs.map(f=><div key={f.question}><dt className="font-semibold">{f.question}</dt><dd className="mt-2 text-muted-foreground">{f.answer}</dd></div>)}</dl>
  <JsonLd data={getFaqSchema(faqs,locale)} />
  {children.length>0&&<nav aria-label={pt?'Tarefas relacionadas':'Related tasks'}><ul className="space-y-2">{children.map(p=><li key={p.slug}><Link className="underline" href={new URL(p.canonicalUrl).pathname}>{p.h1}</Link></li>)}</ul></nav>}
  {pt&&<nav aria-label="Outras ferramentas"><Link className="underline" href="/pt-br">Todas as ferramentas de PDF</Link><span> · </span><Link className="underline" href={localizedToolPath(toolId==='merge-pdf'?'organize-pdf':'merge-pdf','pt-BR')}>{toolId==='merge-pdf'?'Organizar PDF':'Juntar PDF'}</Link><span> · </span><Link className="underline" href={'/'+tool.canonicalSlug} hrefLang="en">Versão em inglês</Link></nav>}
 </section>;
}
