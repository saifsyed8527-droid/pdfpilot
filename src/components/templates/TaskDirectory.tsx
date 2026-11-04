"use client";

import Link from "next/link";
import { useState } from "react";

export interface TaskCard {
  path: string; title: string; purpose: string; tool: string; group: string;
}
const groups = [
  { id: "documents", title: "PDF and document tasks" },
  { id: "images", title: "Image tasks" },
  { id: "data", title: "Spreadsheet and developer tasks" },
];
export function TaskDirectory({ cards }: { cards: TaskCard[] }) {
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = cards.filter(card => words.every(word => (card.title + " " + card.purpose + " " + card.tool).toLowerCase().includes(word)));
  return <>
    <label className="mt-6 block max-w-xl text-sm font-medium">Find a task or tool
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by outcome, tool or file format" className="mt-2 block w-full rounded-lg border bg-background px-4 py-3" />
    </label>
    <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">{matches.length} {matches.length === 1 ? "template" : "templates"}</p>
    <nav aria-label="Jump to a task family" className="my-6 flex flex-wrap gap-4">{groups.filter(group => matches.some(card => card.group === group.id)).map(group => <a key={group.id} href={"#" + group.id} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{group.title}</a>)}</nav>
    {groups.map(group => {
      const entries = matches.filter(card => card.group === group.id);
      if (!entries.length) return null;
      return <section key={group.id} id={group.id} className="my-10 scroll-mt-24">
        <h2 className="mb-4 text-2xl font-bold">{group.title}</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{entries.map(card => <li key={card.path} className="rounded-xl border p-4">
          <Link href={card.path} prefetch={false} className="font-semibold text-primary hover:underline">{card.title}</Link>
          <p className="mt-2 text-sm text-muted-foreground">{card.purpose}</p>
        </li>)}</ul>
      </section>;
    })}
    {!matches.length && <p>No tasks match this search. <button onClick={() => setQuery("")} className="underline">Show all templates</button></p>}
  </>;
}
