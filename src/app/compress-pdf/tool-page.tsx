import { ToolGrowthLinks } from "@/components/seo/ToolGrowthLinks";
import { CompressPdfClient } from "./compress-pdf-client";
import { IntentPage, intentMetadata } from "@/components/pdf-intents/IntentPage";
import { getPdfIntent } from "@/lib/content/pdf-intents";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";

const page = getPdfIntent("/compress-pdf")!;
export const metadata = { ...intentMetadata(page), alternates: { canonical: page.path, languages: getHreflangLanguagesMap(page.path) } };

export default function Page() { return <IntentPage page={page} />; }

/** Localized routes retain the shared processing workspace and their translated landing copy. */
export function ToolWorkspace({ landingCopy }: { landingCopy?: import("@/lib/i18n/core-content").ToolLandingCopy } = {}) {
  return <><CompressPdfClient landingCopy={landingCopy} /><ToolGrowthLinks tool="compress-pdf" /></>;
}
