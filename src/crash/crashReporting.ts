import * as Sentry from '@sentry/react-native';

/**
 * Crash reports only (specs.md §8): no personal data, no performance tracing, no session replay.
 * Off in development and whenever the build has no DSN.
 */
export function crashReportingOptions(dsn: string | undefined, dev: boolean): Sentry.ReactNativeOptions {
  return {
    dsn: dsn ?? '',
    enabled: Boolean(dsn) && !dev,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
  };
}

export function initCrashReporting(): void {
  Sentry.init(crashReportingOptions(process.env.EXPO_PUBLIC_SENTRY_DSN, __DEV__));
}

/** Reports a handled error (such as saved data that could not be read). Never throws. */
export function reportError(error: unknown, where: string): void {
  try {
    Sentry.captureException(error, { tags: { where } });
  } catch {
    // Reporting must never get in the way of play.
  }
}

export const wrapRoot = Sentry.wrap;
