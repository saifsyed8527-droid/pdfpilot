import { ToolGrowthLinks } from "@/components/seo/ToolGrowthLinks";
import { MergePdfClient } from "./merge-pdf-client";
import { IntentPage, intentMetadata } from "@/components/pdf-intents/IntentPage";
import { getPdfIntent } from "@/lib/content/pdf-intents";
import { getHreflangLanguagesMap } from "@/lib/i18n/hreflang";

const page = getPdfIntent("/merge-pdf")!;
export const metadata = { ...intentMetadata(page), alternates: { canonical: page.path, languages: getHreflangLanguagesMap(page.path) } };

export default function Page() { return <IntentPage page={page} />; }

/** Localized routes retain the shared processing workspace and their translated landing copy. */
export function ToolWorkspace({ landingCopy }: { landingCopy?: import("@/lib/i18n/core-content").ToolLandingCopy } = {}) {
  return <><MergePdfClient landingCopy={landingCopy} /><ToolGrowthLinks tool="merge-pdf" /></>;
}
