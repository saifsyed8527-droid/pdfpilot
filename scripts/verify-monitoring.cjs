// One manual synthetic delivery check. Never runs on startup or in CI.
const Sentry = require('@sentry/nextjs');
const { load } = require('./load-pseo-modules.cjs');
const { monitoringOptions } = load('src/lib/monitoring/privacy.ts');
async function main() {
  const options = monitoringOptions();
  if (!options.enabled) throw new Error('Set a valid NEXT_PUBLIC_SENTRY_DSN before running this check.');
  Sentry.init(options);
  const eventId = Sentry.captureException(new TypeError('SYNTHETIC-PRIVACY-CANARY.pdf'), {
    extra: { document: 'SYNTHETIC-PRIVACY-CANARY.pdf' },
  });
  const flushed = await Sentry.close(10000);
  console.log(JSON.stringify({ eventId, flushed, verification: 'Confirm this event ID in Sentry; a flush alone is not ingestion proof.' }));
  if (!flushed) process.exitCode = 1;
}
main().catch(() => { console.error('Monitoring check failed. Inspect configuration and delivery without logging secrets.'); process.exitCode = 1; });
