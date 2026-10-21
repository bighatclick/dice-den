// Adds crash reporting (specs.md §8: Sentry, crash reports only) on top of app.json.
// It is off unless EXPO_PUBLIC_SENTRY_DSN is set when building; source maps upload
// only when SENTRY_AUTH_TOKEN is also set.
const { withSentry } = require('@sentry/react-native/expo');

module.exports = ({ config }) =>
  withSentry(config, {
    url: 'https://sentry.io/',
    organization: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    disableAutoUpload: !process.env.SENTRY_AUTH_TOKEN,
    // Starts the native SDK before JavaScript, so crashes during app start are reported too.
    useNativeInit: true,
    options: {
      // An empty DSN keeps the SDK switched off.
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
      sendDefaultPii: false,
      tracesSampleRate: 0,
    },
  });
