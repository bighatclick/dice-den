import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from './theme';

/** Green baize behind the dice tray (approved v2 game table). */
export function Felt() {
  const { colors } = useTheme();
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        <RadialGradient id="felt" cx="50%" cy="0%" rx="130%" ry="75%" fx="50%" fy="0%">
          <Stop offset="0" stopColor={colors.feltHi} />
          <Stop offset="0.45" stopColor={colors.felt} />
          <Stop offset="0.8" stopColor={colors.feltLo} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill="url(#felt)" />
    </Svg>
  );
}
