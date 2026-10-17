import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useEquipped } from '../state/cosmetics';
import type { TableStyle } from './cosmetics';
import { useTheme } from './theme';

/** The table behind the dice tray: the equipped one, or `table` for shop previews. */
export function Felt({ table }: { table?: TableStyle } = {}) {
  const { colors } = useTheme();
  const equipped = useEquipped().table;
  const t = table ?? equipped;
  const [hi, mid, lo] = t.colors ?? [colors.feltHi, colors.felt, colors.feltLo];
  const id = `table-${t.id}`;
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="0%" rx="130%" ry="75%" fx="50%" fy="0%">
          <Stop offset="0" stopColor={hi} />
          <Stop offset="0.45" stopColor={mid} />
          <Stop offset="0.8" stopColor={lo} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}
