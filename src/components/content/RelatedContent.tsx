import Link from "next/link";
import type { ResolvedEntity } from "@/lib/content/registry";

const TYPE_LABELS: Record<string, string> = {
  tool: "Tool",
  category: "Category",
  guide: "Guide",
  comparison: "Comparison",
  "use-case": "Use Case",
  help: "Help",
  faq: "FAQ",
  "learning-resource": "Learning Resource",
};

interface RelatedContentProps {
  title?: string;
  items: ResolvedEntity[];
}

/**
 * Renders a list of related entities of any content type. Pages never
 * hardcode "related tool" vs. "related guide" link markup — they resolve
 * their `related: EntityRef[]` via src/lib/content/registry.ts and hand
 * the result to this one component.
 */
export function RelatedContent({ title = "Related", items }: RelatedContentProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold mb-4">{title}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.path}>
            <span className="text-xs text-muted-foreground uppercase tracking-wide mr-2">
              {TYPE_LABELS[item.type] ?? item.type}
            </span>
            <Link
              href={item.path}
              className="inline-block py-1 text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
            >
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
