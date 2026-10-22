// Adds crash reporting (specs.md §8: Sentry, crash reports only) on top of app.json.
// It is off unless EXPO_PUBLIC_SENTRY_DSN is set when building; source maps upload
// only when SENTRY_AUTH_TOKEN is also set.
const { withSentry } = require('@sentry/react-native/expo');

// Matches src/config/features.ts: ads and purchases are off unless a build sets this.
const MONETIZATION = process.env.EXPO_PUBLIC_MONETIZATION === '1';

// Google's sample AdMob app ids. A release with ads switched on needs the real ones
// in ADMOB_ANDROID_APP_ID / ADMOB_IOS_APP_ID.
const TEST_ADMOB_APP_IDS = {
  android: 'ca-app-pub-3940256099942544~3347511713',
  ios: 'ca-app-pub-3940256099942544~1458002511',
};

// Never needed: the Expo template adds it for the dev menu overlay.
const ALWAYS_BLOCKED = ['android.permission.SYSTEM_ALERT_WINDOW'];

// Added by the ad and billing SDKs, which stay linked so ads can come back with a flag.
// With monetization off nothing uses them, so the app doesn't ask for them.
const MONETIZATION_PERMISSIONS = [
  'com.google.android.gms.permission.AD_ID',
  'android.permission.ACCESS_ADSERVICES_AD_ID',
  'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
  'android.permission.ACCESS_ADSERVICES_TOPICS',
  'com.android.vending.BILLING',
  'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE',
];

function pluginName(p) {
  return Array.isArray(p) ? p[0] : p;
}

function withMonetizationSwitch(config) {
  const plugins = config.plugins
    // The tracking prompt text only belongs in a build that can show ads.
    .filter((p) => MONETIZATION || pluginName(p) !== 'expo-tracking-transparency')
    .map((p) => {
      if (pluginName(p) !== 'react-native-google-mobile-ads') return p;
      const androidAppId = process.env.ADMOB_ANDROID_APP_ID || TEST_ADMOB_APP_IDS.android;
      const iosAppId = process.env.ADMOB_IOS_APP_ID || TEST_ADMOB_APP_IDS.ios;
      if (MONETIZATION && (androidAppId === TEST_ADMOB_APP_IDS.android || iosAppId === TEST_ADMOB_APP_IDS.ios)) {
        console.warn('Dice Den: ads are on but ADMOB_ANDROID_APP_ID / ADMOB_IOS_APP_ID are not set; using Google test ids.');
      }
      return [p[0], { ...p[1], androidAppId, iosAppId }];
    });
  const blockedPermissions = [...ALWAYS_BLOCKED, ...(MONETIZATION ? [] : MONETIZATION_PERMISSIONS)];
  return { ...config, plugins, android: { ...config.android, blockedPermissions } };
}

module.exports = ({ config }) =>
  withSentry(withMonetizationSwitch(config), {
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
