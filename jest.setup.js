// Worklets' official mock; Reanimated is mapped to jest/reanimated-mock.js in jest.config.js.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// Icon fonts load through expo-asset, which has no asset registry under Jest.
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text } = require('react-native');
  const Icon = ({ name }) => require('react').createElement(Text, { accessible: false }, `[${name}]`);
  Icon.glyphMap = {};
  return { __esModule: true, default: Icon };
});

// Share card capture and the share sheet are native-only.
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => 'file:///tmp/share.png') }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), seekTo: jest.fn(async () => undefined) })),
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
}));

// Ads, purchases and ATT are native-only; tests swap in fakes (src/testing/fakeAds.ts,
// src/iap/fakeStore.ts). These stubs only keep the real wrappers from crashing on import.
jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({
    initialize: jest.fn(async () => []),
    setRequestConfiguration: jest.fn(async () => undefined),
    setAppMuted: jest.fn(),
    setAppVolume: jest.fn(),
  }),
  AdsConsent: {
    gatherConsent: jest.fn(async () => ({ canRequestAds: false })),
    getConsentInfo: jest.fn(async () => ({ privacyOptionsRequirementStatus: 'NOT_REQUIRED' })),
    showPrivacyOptionsForm: jest.fn(async () => ({})),
  },
  AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED', NOT_REQUIRED: 'NOT_REQUIRED' },
  AdsConsentDebugGeography: { EEA: 1, NOT_EEA: 2 },
  AdEventType: { LOADED: 'loaded', ERROR: 'error', OPENED: 'opened', CLOSED: 'closed' },
  RewardedAdEventType: { LOADED: 'rewarded_loaded', EARNED_REWARD: 'rewarded_earned_reward' },
  MaxAdContentRating: { G: 'G' },
  TestIds: { INTERSTITIAL: 'test-interstitial', REWARDED: 'test-rewarded' },
  InterstitialAd: { createForAdRequest: jest.fn() },
  RewardedAd: { createForAdRequest: jest.fn() },
}));
jest.mock('expo-iap', () => ({
  ErrorCode: { AlreadyOwned: 'already-owned', UserCancelled: 'user-cancelled', Pending: 'pending', DeferredPayment: 'deferred-payment' },
  initConnection: jest.fn(async () => false),
  fetchProducts: jest.fn(async () => []),
  getAvailablePurchases: jest.fn(async () => []),
  restorePurchases: jest.fn(async () => undefined),
  requestPurchase: jest.fn(async () => null),
  finishTransaction: jest.fn(async () => undefined),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('expo-tracking-transparency', () => ({
  isAvailable: jest.fn(() => true),
  requestTrackingPermissionsAsync: jest.fn(async () => ({ granted: false })),
}));
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (component) => component,
  captureException: jest.fn(),
}));
