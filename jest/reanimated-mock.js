// Minimal Reanimated stand-in for Jest. The package's own mock loads the native
// entry point, which throws under Jest with Reanimated 4.7 + Worklets 0.13.
// react-native is required lazily: expo-router's test mocks load this file from
// inside a jest.mock factory, where an eager require would be circular.
const React = require('react');

const identity = (v) => v;
const createAnimatedComponent = (getComponent) =>
  React.forwardRef((props, ref) => {
    const Component = typeof getComponent === 'string' ? require('react-native')[getComponent] : getComponent;
    return React.createElement(Component, { ...props, ref });
  });
const easingFn = () => identity;
const Easing = new Proxy({}, { get: () => easingFn });

const Animated = {
  View: createAnimatedComponent('View'),
  Text: createAnimatedComponent('Text'),
  ScrollView: createAnimatedComponent('ScrollView'),
  Image: createAnimatedComponent('Image'),
  FlatList: createAnimatedComponent('FlatList'),
  createAnimatedComponent,
  call: () => {},
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  Easing,
  useSharedValue: (init) => ({ value: init }),
  useAnimatedStyle: (fn) => fn(),
  useDerivedValue: (fn) => ({ value: fn() }),
  useAnimatedProps: (fn) => fn(),
  useReducedMotion: () => false,
  withTiming: identity,
  withSpring: identity,
  withDelay: (_ms, v) => v,
  withRepeat: identity,
  withSequence: (...values) => values[values.length - 1],
  cancelAnimation: () => {},
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  interpolate: (v) => v,
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
};
