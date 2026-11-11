# PDF Pilot content and technical release checklist

User-adopted source: Copy of UT - Developers SEO checklist.docx, received 11 November 2026. The attachment is reference material; current user instructions define the work. Apply the checks below before uploading new or changed on-page content. Existing research order and stable Page IDs remain in force.

## Before publishing content

- Identify exact URL, language, market, page owner and intended task. Reuse existing pages for synonyms. Follow the accepted keyword/page map; do not create doorway pages.
- Review accurate, useful, original copy against the actual tool and its limits. Review AI-assisted translations and all visible workspace controls, errors and recovery text. Language-menu presence is not complete translation.
- Verify a successful canonical URL, one descriptive H1, useful headings, unique title/description, meaningful image alternatives and working contextual/breadcrumb links. Title and snippet lengths are guidance, not fixed Google indexing limits.
- Verify HTTPS, consistent hostname and URL format, no redirect chain, self-canonical and equivalent reciprocal hreflang. Keep user files, private results, drafts and incomplete translations out of search.
- XML sitemap must include only canonical, indexable URLs, exactly once across the submitted tree. Each child of the root is a URL sitemap, with bounded response size. Use lastmod only when a real page modification date is known.
- Emit truthful SoftwareApplication and BreadcrumbList markup on tools, Organization and WebSite sitewide. FAQ markup must match visible questions and answers. Never invent ratings or reviews to obtain a rich result.
- Check mobile and desktop rendering, keyboard use and real file → processing → downloaded-output behavior, including malformed input and recovery. A unit-test pass does not establish all-file correctness.
- Review performance using measured lab evidence and available field data. Do not invent a Core Web Vitals pass when CrUX/GSC field data is absent.
- Run `npm run check:seo`, `npm run typecheck`, relevant processing regressions, and `npm run build`. Record command results and actual tested scope. Verify deployed HTML, sitemap and affected outputs after an authorized release.
- Update the existing SEO tracker and append Update Log. Keep prepared, reviewed, implemented, live and indexed separate.

## Clarifications to the supplied document

PDF Pilot is Next.js, not Wix/Apache: use framework/host configuration, not an .htaccess file. Robots.txt is not a privacy mechanism and Google does not support its crawl-delay directive. A canonical is a hint, not a guaranteed indexing decision. `nofollow` is a link relationship hint, not a general crawl prohibition. Responsive design is appropriate here despite the attachment's ambiguous table formatting. Software schema does not guarantee Google's rich results; no fake ratings will be added.

References: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap and https://developers.google.com/search/docs/appearance/structured-data/software-app.

## Execution placement

Develop and test on the local Mac; serve the public website from the existing cloud host. PDF processing continues in the visitor's browser. No new paid infrastructure, DNS migration or always-on local server is required by this change. Cloud subscription, usage allowance and commercial eligibility have not been independently audited; no promise of unlimited free hosting is made.

## 11 November checkpoint

Live baseline: 109/109 tools passed HTTP/canonical/initial-head/H1/tool-schema checks. 25 sitemap children returned HTTP 200; 8,982 entries represented 8,964 unique URLs with 18 repeated resource/pSEO URLs. Those repeated URLs remain discoverable through their resource family with hreflang; old pSEO URLs remain readable for compatibility.

Additional language copy is a draft until full workspace and linguistic review passes. Keep it out of production indexing. No new editorial articles or keyword landing pages are authorized by a translation draft or sitemap repair.
