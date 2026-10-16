import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { Face } from '../engine/dice';
import { fonts } from './tokens';
import { useTheme } from './theme';

/** Pip centres on a 100×100 face (same layout as the approved mockup). */
export const PIPS: Record<Face, readonly (readonly [number, number])[]> = {
  1: [[50, 50]],
  2: [[29, 29], [71, 71]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[29, 29], [71, 29], [29, 71], [71, 71]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[29, 25], [71, 25], [29, 50], [71, 50], [29, 75], [71, 75]],
};

/** Static ivory die face. */
export function DieFace({ value, size, highContrast = false }: { value: Face; size: number; highContrast?: boolean }) {
  const { colors } = useTheme();
  const r = highContrast ? 11.5 : 10;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="face" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.dieFace} />
          <Stop offset="0.55" stopColor="#F6EEE1" />
          <Stop offset="1" stopColor={colors.dieFaceLo} />
        </LinearGradient>
        <RadialGradient id="pip" cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor={highContrast ? '#000000' : '#5A3E2B'} />
          <Stop offset="0.55" stopColor={highContrast ? '#000000' : colors.pip} />
          <Stop offset="1" stopColor="#120A05" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" rx="24" fill="url(#face)" />
      {PIPS[value].map(([x, y]) => (
        <Circle key={`h${x}-${y}`} cx={x} cy={y + 1.2} r={r} fill="rgba(255,255,255,0.9)" />
      ))}
      {PIPS[value].map(([x, y]) => (
        <Circle key={`p${x}-${y}`} cx={x} cy={y} r={r} fill="url(#pip)" />
      ))}
    </Svg>
  );
}

/** Small resting tilt so unheld dice look thrown, stable for a given roll. */
function restingTilt(index: number, rollSeq: number): number {
  return (((rollSeq * 7 + index * 13) % 21) - 10) * 1.1;
}

interface DieProps {
  index: number;
  value: Face;
  held: boolean;
  /** False before the first roll of a turn and after the third. */
  canHold: boolean;
  /** Dice are blank until the turn's first roll. */
  rolled: boolean;
  rollSeq: number;
  size?: number;
  highContrast?: boolean;
  onToggle: (index: number) => void;
}

export function Die({ index, value, held, canHold, rolled, rollSeq, size = 56, highContrast, onToggle }: DieProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(held ? 1 : 0);
  const spin = useSharedValue(0);
  const drop = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    lift.value = reduceMotion ? (held ? 1 : 0) : withSpring(held ? 1 : 0, { damping: 14, stiffness: 220 });
  }, [held, reduceMotion, lift]);

  useEffect(() => {
    if (rollSeq === 0 || held) return;
    if (reduceMotion) {
      // Reduce Motion: cross-fade instead of the tumble (specs.md §9).
      fade.value = withSequence(withTiming(0.35, { duration: 0 }), withTiming(1, { duration: 220 }));
      return;
    }
    const direction = (rollSeq + index) % 2 === 0 ? 1 : -1;
    const ease = Easing.out(Easing.cubic);
    spin.value = withSequence(withTiming(direction * 540, { duration: 0 }), withTiming(0, { duration: 450, easing: ease }));
    drop.value = withSequence(withTiming(-36 - index * 4, { duration: 0 }), withTiming(0, { duration: 450, easing: Easing.bounce }));
    // Only roll changes should tumble; `held` is read at the moment of the roll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollSeq]);

  const tilt = held || !rolled ? 0 : restingTilt(index, rollSeq);
  const animated = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      { translateY: drop.value - lift.value * 12 },
      { scale: 1 + lift.value * 0.04 },
      { rotate: `${spin.value + tilt}deg` },
    ],
  }));

  const label = rolled
    ? t(held ? 'game.dieHeld' : 'game.die', { n: index + 1, value })
    : t('game.dieNotRolled', { n: index + 1 });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={canHold ? t(held ? 'game.releaseHint' : 'game.holdHint') : undefined}
      accessibilityState={{ selected: held, disabled: !canHold }}
      disabled={!canHold}
      onPress={() => onToggle(index)}
      hitSlop={6}
      style={styles.hit}
    >
      <Animated.View
        style={[
          styles.die,
          {
            width: size,
            height: size,
            borderRadius: size * 0.24,
            opacity: rolled ? 1 : 0.45,
            shadowColor: held ? colors.mint : '#000',
            shadowOpacity: held ? 0.75 : 0.45,
            shadowRadius: held ? 14 : 8,
            borderColor: held ? colors.mint : 'transparent',
          },
          animated,
        ]}
      >
        <View style={[styles.edge, { borderRadius: size * 0.24, backgroundColor: colors.dieEdge }]} />
        <DieFace value={value} size={size - 6} highContrast={highContrast} />
      </Animated.View>
      <View style={styles.tagSlot}>
        {held ? (
          <View style={styles.tag} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Ionicons name="lock-closed" size={9} color={colors.mint} />
            <Text style={[styles.tagText, { color: colors.mint }]}>{t('game.held')}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { alignItems: 'center', minWidth: 44, minHeight: 44 },
  die: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 4 },
  tagSlot: { height: 18, marginTop: 6, justifyContent: 'center' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tagText: { fontFamily: fonts.heavy, fontSize: 9, letterSpacing: 1.1 },
});
