import { Card, CardContent } from "@/components/ui/card";
import { RelatedContent } from "./RelatedContent";
import type { ResolvedEntity } from "@/lib/content/registry";

interface ToolRelatedContentProps {
  items: ResolvedEntity[];
}

/**
 * The one place a Tool page renders "what content links to me" — Guides,
 * Help, Comparisons, Use Cases, and Categories, resolved server-side via
 * getContentReferencingTool and handed down as plain data, the same way
 * `faqs` already is. Mirrors EntityPageLayout's own related-content Card so
 * the visual language matches every other page type that renders this.
 */
export function ToolRelatedContent({ items }: ToolRelatedContentProps) {
  if (items.length === 0) return null;

  return (
    <Card className="mt-8">
      <CardContent className="pt-6">
        <RelatedContent title="Related Content" items={items} />
      </CardContent>
    </Card>
  );
}
