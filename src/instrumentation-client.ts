import * as Sentry from '@sentry/nextjs';
import { monitoringOptions } from './lib/monitoring/privacy';

const options = monitoringOptions();
if (options.enabled) {
  Sentry.init({ ...options, integrations: [Sentry.globalHandlersIntegration(), Sentry.browserApiErrorsIntegration()] });
}
