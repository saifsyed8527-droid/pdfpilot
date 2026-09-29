# Publish the reviewed local batch

Prepared from the existing checkout on `codex/pseo-engine`, above commit `67682f58a7cded3a21cce4984d4900e753906986`. GitHub `main` still matched that commit at the final check. No production push or deployment has been performed for this batch.

Run this in Terminal after reviewing the reports:

```sh
cd "/Users/apple/Documents/Claude/Projects/PDF Pilot/pseo-engine" &&
git fetch origin main &&
git merge-base --is-ancestor origin/main HEAD &&
npm run pseo -- validate &&
npm run lint &&
npm test &&
npm run build &&
git add src scripts tests data/pseo/manifests data/pseo/reports docs/pseo &&
git commit -m "Improve indexation and add reviewed Brazil SEO pages" &&
git push origin HEAD:main
```

The ancestry check stops if production has advanced beyond this checkout. Do not force-push to bypass it; integrate and validate the newer production changes first. A failure in any check stops the remaining commands.

The existing GitHub integration deploys `main` to the PDFPilot Vercel production project, as verified by the previous Ready deployment. A separate `vercel --prod` command is not required. This checkout has no `.vercel/project.json`, so a direct CLI deploy would need explicit project linking first and could duplicate the Git-triggered deployment.

After the push, wait for the matching Vercel commit to show Ready. Check `/sitemap.xml`, each family sitemap, all 12 approved pSEO routes, Portuguese aliases, noindex content holds and representative tool downloads on the public domain. Only then update the deployment baseline and submit the root sitemap in Search Console. The reports distinguish local eligibility from a future Google recrawl/indexing result.

The [indexation report](../../indexation/2026-09-29/REPORT.md), [Brazil report](REPORT.md), and `evidence/tested-source.json` identify the reviewed scope and exact source hashes. Raw research files, full row ledgers, browser screenshots, dependencies, environment files and local build output remain ignored by Git. Compact review evidence and derived reports are versioned.
