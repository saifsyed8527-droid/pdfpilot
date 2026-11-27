import type { ErrorEvent, EventHint } from '@sentry/nextjs';

const errorTypes = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError']);

export function sentryOrigin(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    if (url.protocol !== 'https:' || url.password || url.port || url.search || url.hash ||
        !/^[a-f0-9]{32}$/.test(url.username) || !/^\/\d+$/.test(url.pathname) ||
        !/^o\d+\.ingest(?:\.[a-z]{2})?\.sentry\.io$/.test(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

/** Rebuild events so document names, parser messages and request data are excluded. */
export function sanitizeErrorEvent(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  hint.attachments = [];
  if (!event.exception?.values?.length) return null;
  const values = event.exception.values.slice(0, 3).map(exception => {
    const frames = (exception.stacktrace?.frames ?? []).flatMap(frame => {
        const filename = frame.filename ?? '';
        if (!/(?:\/_next|\/\.next)\/(?:static|server)\/chunks\//.test(filename)) return [];
        const match = filename.match(/\/((?:(?:webpack|framework|main-app|main|polyfills|page|layout|error|global-error|not-found|[0-9]+)-)?[a-f0-9]{8,}|[0-9]+)\.js(?:[?#].*)?$/);
        if (!match) return [];
        return [{
          filename: `app:///chunks/${match[1]}.js`,
          ...(Number.isSafeInteger(frame.lineno) && frame.lineno! > 0 ? { lineno: frame.lineno } : {}),
          ...(Number.isSafeInteger(frame.colno) && frame.colno! >= 0 ? { colno: frame.colno } : {}),
          in_app: true,
        }];
      }).slice(-30);
    return {
      type: errorTypes.has(exception.type ?? '') ? exception.type : 'Error',
      value: 'Application error; message omitted for document privacy',
      ...(frames.length ? { stacktrace: { frames } } : {}),
    };
  });
  return {
    ...(event.event_id && /^[a-f0-9]{32}$/.test(event.event_id) ? { event_id: event.event_id } : {}),
    ...(Number.isFinite(event.timestamp) ? { timestamp: event.timestamp } : {}),
    ...(event.release && /^[a-f0-9]{7,40}$/.test(event.release) ? { release: event.release } : {}),
    type: undefined, level: 'error', platform: 'javascript', exception: { values },
  };
}

export function monitoringOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn, enabled: sentryOrigin(dsn) !== null, defaultIntegrations: false as const,
    maxBreadcrumbs: 0, tracesSampleRate: 0, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0,
    enableLogs: false, autoSessionTracking: false,
    dataCollection: {
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
      graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false }, databaseQueryData: false, queues: false,
      stackFrameVariables: false, frameContextLines: 0,
    },
    beforeBreadcrumb: () => null, beforeSend: sanitizeErrorEvent,
    beforeSendLog: () => null, beforeSendMetric: () => null,
  };
}
