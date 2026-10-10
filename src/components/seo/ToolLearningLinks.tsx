import Link from "next/link";
import { getToolLearningLinks } from "@/lib/content/tool-related";

/** Server-rendered discovery below the tool; processing controls stay unchanged. */
export function ToolLearningLinks({ toolId }: { toolId: string }) {
  const { categories, items } = getToolLearningLinks(`tool-${toolId}`);
  if (!categories.length && !items.length) return null;
  return (
    <nav aria-label="Guides and troubleshooting" className="space-y-4 border-t pt-7">
      <h2 className="text-xl font-semibold">Guides and troubleshooting</h2>
      <p className="text-muted-foreground">Find the right settings, solve common problems, or plan your next step.</p>
      <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {items.map(item => <li key={item.id}><Link className="underline underline-offset-4 hover:text-primary" href={item.path}>{item.title}</Link></li>)}
      </ul>
      {categories.map(category => <p key={category.id}><Link className="font-medium underline underline-offset-4" href={category.path}>Explore {category.title.toLowerCase()}</Link></p>)}
    </nav>
  );
}
