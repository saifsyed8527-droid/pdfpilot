import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeClient } from "@/app/home-client";
import { SEARCH_INDEX } from "@/lib/search-index";
import { CORE_COPY } from "@/lib/i18n/core-content";
import { getActiveLocales, getLocaleBySegment } from "@/lib/i18n/locales";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";
import { getPseoPage, PSEO_PAGES } from "@/lib/pseo/registry";
import { intentMetadata } from "@/lib/pseo/metadata";
import { IntentPage } from "@/components/pseo/IntentPage";
type Params = Promise<{ locale: string }>;
// Split the previous optional catch-all at its root boundary. Public/localized URLs stay identical.
export function generateStaticParams() {
  return [...getActiveLocales().filter(l=>l.code!=="en").map(l=>({locale:l.segment})), ...PSEO_PAGES.map(p=>({locale:p.slug}))];
}
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const segment=(await params).locale;
  const page=getPseoPage(segment);if(page)return intentMetadata(page);
  const locale=getLocaleBySegment(segment);if(!locale||!locale.active||locale.code==="en")notFound();
  const copy=CORE_COPY[locale.code].home;const url=`/${locale.segment}`;
  return { title:copy.seoTitle,description:copy.seoDescription,alternates:{canonical:url,languages:getHreflangLanguagesMap("/")},
    openGraph:{type:"website",siteName:"PDFPilot",locale:locale.ogLocale,alternateLocale:getActiveLocales().filter(l=>l.code!==locale.code).map(l=>l.ogLocale),title:copy.seoTitle,description:copy.seoDescription,url,images:[{url:"/og/home.png",width:1200,height:630,type:"image/png",alt:copy.seoTitle}]},
    twitter:{card:"summary_large_image",title:copy.seoTitle,description:copy.seoDescription,images:["/og/home.png"]},
  };
}
export default async function RootSegmentPage({params}:{params:Params}) {
  const segment=(await params).locale;const page=getPseoPage(segment);if(page)return <IntentPage page={page}/>;
  const locale=getLocaleBySegment(segment);if(!locale||!locale.active||locale.code==="en")notFound();
  return <HomeClient searchIndex={[...SEARCH_INDEX]} locale={locale.code}/>;
}
