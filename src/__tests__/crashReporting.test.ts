import * as Sentry from '@sentry/react-native';
import { crashReportingOptions, reportError } from '../crash/crashReporting';

describe('crash reporting', () => {
  it('is off without a DSN and in development', () => {
    expect(crashReportingOptions(undefined, false).enabled).toBe(false);
    expect(crashReportingOptions('', false).enabled).toBe(false);
    expect(crashReportingOptions('https://key@o1.ingest.sentry.io/1', true).enabled).toBe(false);
  });

  it('sends crash reports only, with no personal data', () => {
    const options = crashReportingOptions('https://key@o1.ingest.sentry.io/1', false);
    expect(options.enabled).toBe(true);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.attachScreenshot).toBe(false);
  });

  it('never throws when reporting fails', () => {
    (Sentry.captureException as jest.Mock).mockImplementationOnce(() => {
      throw new Error('offline');
    });
    expect(() => reportError(new Error('bad data'), 'repository.load:corrupt')).not.toThrow();
  });
});
