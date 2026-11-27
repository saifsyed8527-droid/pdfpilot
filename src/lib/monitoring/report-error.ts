/** Monitoring failures must never interrupt the existing error/retry screen. */
export function reportError(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import('@sentry/nextjs').then(Sentry => Sentry.captureException(error)).catch(() => {});
}
