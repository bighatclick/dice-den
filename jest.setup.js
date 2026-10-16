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
