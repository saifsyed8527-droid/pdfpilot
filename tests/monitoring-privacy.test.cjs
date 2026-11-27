const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./load-ts.cjs');
const { sanitizeErrorEvent, monitoringOptions, sentryOrigin } = loadTs('src/lib/monitoring/privacy.ts');
const dsn = `https://${'a'.repeat(32)}@o0.ingest.us.sentry.io/1`;

test('DSN allows hosted Sentry only, with no wildcard or arbitrary CSP origin', () => {
  assert.equal(sentryOrigin(dsn), 'https://o0.ingest.us.sentry.io');
  for (const invalid of ['', 'https://example.com/1', dsn + '?token=x', dsn + '#x', dsn.replace('https:', 'http:'), dsn.replace('@', ':secret@'), dsn.replace('.io/', '.io.evil.test/')]) {
    assert.equal(sentryOrigin(invalid), null);
  }
});

test('rebuilds errors without document details, URLs, identity, breadcrumbs or attachments', () => {
  const privateValue = 'PRIVATE-CUSTOMER-DOCUMENT.pdf';
  const hint = { attachments: [{ filename: privateValue, data: privateValue }] };
  const event = {
    event_id: 'a'.repeat(32), timestamp: 12345, release: '9560486',
    message: privateValue, request: { url: privateValue, cookies: privateValue },
    user: { email: privateValue }, extra: { privateValue }, contexts: { document: { privateValue } },
    breadcrumbs: [{ message: privateValue }], tags: { filename: privateValue },
    exception: { values: [{ type: 'TypeError', value: privateValue, stacktrace: { frames: [
      { filename: `https://pdfpilot.net/_next/static/chunks/123-aabbccdd.js?file=${privateValue}`, lineno: 10, colno: 2, vars: { privateValue }, context_line: privateValue, function: privateValue },
      { filename: `blob:https://pdfpilot.net/${privateValue}` },
      { filename: `/Users/example/${privateValue}` },
    ] } }] },
  };
  const result = sanitizeErrorEvent(event, hint);
  assert.ok(!JSON.stringify(result).includes(privateValue));
  assert.deepEqual(hint.attachments, []);
  assert.equal(result.exception.values[0].type, 'TypeError');
  assert.equal(result.exception.values[0].stacktrace.frames.length, 1);
  assert.equal(result.exception.values[0].stacktrace.frames[0].lineno, 10);
  assert.equal(event.exception.values[0].value, privateValue);
  assert.equal(sanitizeErrorEvent({ message: privateValue }, {}), null);
  assert.equal(sanitizeErrorEvent({ exception: { values: [{ type: 'Error', value: privateValue }] } }, {}).exception.values[0].stacktrace, undefined);
});

test('missing DSN disables monitoring; replay, tracing, logs and metrics stay off', () => {
  const previous = process.env.NEXT_PUBLIC_SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  try {
    const options = monitoringOptions();
    assert.equal(options.enabled, false);
    assert.equal(options.defaultIntegrations, false);
    assert.equal(options.replaysSessionSampleRate, 0);
    assert.equal(options.replaysOnErrorSampleRate, 0);
    assert.equal(options.tracesSampleRate, 0);
    assert.equal(options.enableLogs, false);
    assert.equal(options.beforeSendMetric({}), null);
    process.env.NEXT_PUBLIC_SENTRY_DSN = dsn;
    assert.equal(monitoringOptions().enabled, true);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = previous;
  }
});

test('real SDK transport receives filtered events without document canaries', async () => {
  const Sentry = require('@sentry/nextjs');
  const envelopes = [];
  const privateValue = 'PRIVATE-TRANSPORT-CANARY.pdf';
  Sentry.init({
    ...monitoringOptions(), dsn, enabled: true,
    transport: () => ({ send: async envelope => { envelopes.push(envelope); return {}; }, flush: async () => true }),
  });
  try {
    Sentry.captureException(new TypeError(privateValue), {
      user: { email: privateValue }, extra: { privateValue },
      attachments: [{ filename: privateValue, data: privateValue }],
    });
    assert.equal(await Sentry.flush(2000), true);
    assert.ok(envelopes.length > 0);
    assert.ok(!JSON.stringify(envelopes).includes(privateValue));
  } finally { await Sentry.close(2000); }
});

test('all runtime initializers stay inert without a DSN and exclude replay integrations', () => {
  const fs = require('node:fs'), ts = require('typescript');
  for (const filename of ['src/instrumentation-client.ts', 'src/sentry.server.config.ts', 'src/sentry.edge.config.ts']) {
    for (const enabled of [false, true]) {
      const calls = [];
      const sdk = {
        init: options => calls.push(options),
        globalHandlersIntegration: () => ({ name: 'GlobalHandlers' }),
        browserApiErrorsIntegration: () => ({ name: 'BrowserApiErrors' }),
      };
      const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
      const mod = { exports: {} };
      new Function('require', 'module', 'exports', code)(name => name === '@sentry/nextjs' ? sdk : { monitoringOptions: () => ({ ...monitoringOptions(), enabled }) }, mod, mod.exports);
      assert.equal(calls.length, enabled ? 1 : 0, filename);
      if (enabled) assert.deepEqual((calls[0].integrations ?? []).map(item => item.name), filename.includes('client') ? ['GlobalHandlers', 'BrowserApiErrors'] : []);
    }
  }
});
