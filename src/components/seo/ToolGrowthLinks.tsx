import { headers } from 'next/headers';
import { getToolIntents } from '@/lib/pseo/registry';
import Link from 'next/link';
import { PDF_WORKFLOWS, workflowPath } from '@/lib/content/pdf-workflows';
import { parseLocalizedPath, localizedPath } from '@/lib/i18n/url-strategy';
import { resourceDictionary, resourceText } from '@/lib/i18n/resource-copy';
import nav from '@/lib/i18n/resource-nav.json';
export async function ToolGrowthLinks({ tool }: { tool: string }) {
  const {locale} = parseLocalizedPath((await headers()).get('x-pdfpilot-path') ?? '/');
  const words = await resourceDictionary(locale), t=(text:string)=>resourceText(words,text), href=(path:string)=>localizedPath(path,locale);
  const intents = getToolIntents(tool), rows = PDF_WORKFLOWS.filter(row => row.tools.includes(tool));
  if (!rows.length && !intents.length && tool !== 'fill-pdf') return null;
  return <section lang={locale} dir={locale==='ar'?'rtl':'ltr'} className="border-t bg-background px-4 py-10"><nav className="mx-auto max-w-5xl" aria-label={nav[locale].related}>
    <h2 className="text-2xl font-semibold">{nav[locale].related}</h2><ul className="mt-5 grid gap-4 sm:grid-cols-2">
      {intents.map(page=><li key={page.slug}><Link href={href('/'+page.slug)} className="block rounded-xl border p-4 hover:bg-muted"><span className="font-semibold">{t(page.h1)}</span></Link></li>)}
      {rows.map(row=><li key={row.slug}><Link href={href(workflowPath(row))} className="block rounded-xl border p-4 hover:bg-muted"><span className="font-semibold">{t(row.title)}</span><span className="mt-2 block text-sm text-muted-foreground">{t(row.description)}</span></Link></li>)}
      {tool==='fill-pdf'&&<li><Link href={href('/templates')} className="block rounded-xl border p-4 hover:bg-muted"><span className="font-semibold">{nav[locale].templates}</span></Link></li>}
    </ul>{intents.length>0&&<Link className="mt-4 inline-block underline" href={href('/pdf-workflows')+`?tool=${tool}#tasks`}>{nav[locale].workflows}</Link>}
  </nav></section>;
}
