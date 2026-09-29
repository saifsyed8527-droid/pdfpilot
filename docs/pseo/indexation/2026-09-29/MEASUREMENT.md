# Measurement and recrawl follow-up

The saved Page Indexing export is the baseline. It contains a chart and a capped 1,000-URL sample for “Discovered – currently not indexed.” It is not an indexed-URL export or a traffic report. The 1970 dates are unavailable crawl timestamps. No post-deployment Google recrawl/indexing result has been observed in this batch.

Use the wanted-index inventory to join by canonical pathname, with separate families: English core, English pSEO, pt-BR core/home, pt-BR pSEO, other reviewed locales, resources, and workflows/templates. The root sitemap index links separate URL sets; pSEO is additionally split by language and intent family. Do not add totals from overlapping sitemap reports together.

| Measurement | Source | Current availability | Interpretation |
|---|---|---|---|
| Wanted canonical URLs / sitemap membership / status | Saved crawler and wanted inventory | Available before and locally after | Technical eligibility, not proof of Google indexing |
| Indexed wanted URLs | GSC indexed pages / URL Inspection sample | Not supplied | Indexed wanted URLs divided by wanted URLs for each family; never infer from absence in the excluded sample |
| Discovered-not-indexed | Supplied GSC export | 1,219 affected; 1,000 examples | Separate wanted from unwanted; capped sample counts are not population estimates |
| Crawled-not-indexed | Corresponding GSC export | Not supplied | Examine sampled page quality, rendered output, duplication and internal discovery |
| Impressions, clicks, CTR, average position | GSC Performance | Not supplied | Split pages, queries, country and device; compare equal complete periods |
| Organic landing sessions | GA4 landing-page report | Configuration-dependent; no account report verified | Session metric, not Search Console clicks |
| Tool starts | Explicit processing-start event | No uniform core start event verified | Add at the real processing boundary in a separate instrumented change; page views/uploads are not tool starts |
| Tool completions / failures | `tool_conversion_completed`, `tool_conversion_failed` | Existing code integration; no live account totals verified | Join event page location to the inventory; audit coverage by tool before treating totals as complete |
| pSEO opens | `content_opened` with pSEO dimensions | Existing code integration | Page/intent context; research source market is not visitor country |
| Workflow and template actions | Existing `tool_chain_*` and `template_*` events | Existing code integration | Keep starts, completed generation and downloads distinct |

Create GA4 explorations using landing page / page location and tool name; join the inventory to derive page family and language. Keep country from the analytics/GSC dimension, not the research provenance field. Do not send filenames, document text or form values in new events. Existing event coverage must be audited before making a conversion-rate claim.

After the user publishes: verify the production commit, status and all sitemap files. Submit the root index in GSC once; optionally inspect family sitemap reports for observability. Sample the six flagship English tools, two Portuguese tasks, Portuguese PDF-to-Word and three removed locale examples. Request indexing only for a small number of materially improved wanted pages where appropriate, not all legacy URLs.

At 7 days, check fetches, sitemap processing and sampled last-crawl dates. At 14 and 28 days, export both excluded reasons and indexed evidence, plus GSC Performance (pages/queries/countries/devices) using full equal date windows. Google may take longer; these are review dates, not promised recovery dates. At 28 days, compare wanted indexing coverage, impressions, qualified clicks and task completions. A falling exclusion total alone is not success.

Use `python3 scripts/compare-gsc.py PATH_TO_NEW_EXPORT OUTPUT_JSON` for a repeatable excluded-sample comparison. It labels sample differences as sample differences and does not report them as indexing gains. Baseline files are never overwritten. No recurring automation has been scheduled.
