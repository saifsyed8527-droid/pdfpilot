# Business Tools — future architecture (not implemented)

Written for System 8 of the Phase 3 brief: prepare the platform for a
future business/accounting tool family (Tally, GST, ERP, ledger/invoice
conversions) without adding anything fake to the live registry.

## Why nothing was added to `tools-data.json` or `TOOLS`

This project's registry is production-live: any entry added to `TOOLS`
automatically generates a real route, a real nav/mega-menu/footer/sitemap
entry, a real search result, and a real OG image via
`scripts/generate-assets.js` — the entire point of the registry-driven
architecture verified throughout this project. There is no "draft" or
"coming soon" state in that pipeline. Adding an Excel→Tally XML entry
today, with no real conversion logic behind it, would not be
"architecture prep" — it would be a live, linked, indexed, broken page:
exactly the doorway/placeholder page every brief this project has
received explicitly forbids. This doc is the architecture; the registry
stays untouched until real tools exist to put in it.

## Real technical prerequisite this family needs that others didn't

Every existing PDF/Image/Word/Excel/PowerPoint tool wraps a browser-
compatible JS library (pdf-lib, mammoth, docx, officeparser, tesseract.js).
**Tally's XML format has no browser-side JS library** — it's a proprietary
schema (`ENVELOPE`/`REQUESTDATA`/`TALLYMESSAGE` structure) documented only
by Tally Solutions itself, with no maintained npm package found in a
preliminary search. Building this family for real starts with a
dependency-verification pass identical to every other engine
this project added (`npm view`, GitHub activity, `npm audit`) — likely
concluding that a real implementation hand-writes XML generation/parsing
against Tally's published schema (feasible — XML construction needs no
special library, just careful schema-matching) rather than depending on a
third-party package. That verification has not been done; this doc
doesn't assume a happy answer either way.

## Proposed structure, when real tools exist

**Domain**: `Tool.domain` is already a free-form `string` field (see
`src/lib/tools.ts`), documented as "present now so a future second domain
needs no migration." A `"business"` domain value slots in with zero
type changes — verified by reading the field's actual declaration, not
assumed.

**Category**: one new `category-business-accounting-tools` entry in
`categories.ts`, following the exact existing pattern — added only once
at least one real tool exists to populate its `contains` array (an empty
category page is exactly the same "no unique value" problem as an empty
tool page).

**Cluster**: one new `topic-business-documents` entry in
`topic-clusters.ts` — same rule, added once real pillar content exists.

**Real future tool candidates** (named in the brief, not commitments):
Excel → Tally XML, Tally XML → Excel, Excel → XML, XML → Excel,
Invoice → Tally, Ledger Converter, Voucher Converter, GST Converter,
Trial Balance Converter, Chart of Accounts Converter. Each would need its
own honest capability check the same way every existing tool did (e.g.
this project's Phase 2B PDF→Excel investigation, which concluded "defer,
here's why" rather than shipping a thin version) — GST/tax-rule tools in
particular carry real correctness stakes (wrong GST math has real
financial/legal consequences for a user), which raises the accuracy bar
for these tools above most of the current PDF/image family.

**Engine**: a new `business-document-engine.ts` following the established
Engine Layer pattern (tools call the engine, never a raw library
directly) — not started, since there's no verified library or hand-rolled
XML strategy to wrap yet.

## What Phase 4+ actually does to activate this family

1. Run the dependency/feasibility verification named above.
2. Build one real tool (most likely Excel ↔ XML, the most genuinely
   general-purpose and lowest-risk of the list) end-to-end, verified live,
   exactly like every tool in Phase 2B.
3. Only then add the `category`/`cluster`/registry entries — content
   follows working capability, never the other way around.
