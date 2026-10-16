import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PlayerState } from '../engine/game';
import { fonts, radius, space, touchTarget } from './tokens';
import { useTheme } from './theme';

/** Translucent button that sits on the felt. */
export function GlassButton({
  icon,
  label,
  onPress,
  size = touchTarget,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.glass, { width: size, height: size }, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={size * 0.42} color="#FFFFFF" />
    </Pressable>
  );
}

export function Avatar({ player, size = 28 }: { player: PlayerState; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: player.color }]}>
      {player.kind === 'ai' ? (
        <Ionicons name="hardware-chip-outline" size={size * 0.5} color="#FFFFFF" />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{player.name.slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}

/** Player chips along the top of the table; the one playing now has a gold ring. */
export function PlayerBar({
  players,
  current,
  totals,
}: {
  players: readonly PlayerState[];
  current: number;
  totals: readonly number[];
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.players}>
      {players.map((p, i) => {
        const on = i === current;
        return (
          <View
            key={p.id}
            accessible
            accessibilityLabel={t(on ? 'game.playerTurn' : 'game.playerTotal', { name: p.name, points: totals[i] })}
            style={[
              styles.player,
              on ? { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: colors.goldHi } : styles.playerOff,
            ]}
          >
            <Avatar player={p} />
            <View>
              <Text style={[styles.playerName, { color: colors.onFelt }]} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={[styles.playerPoints, { color: colors.onFelt }]}>{totals[i]}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

/** The three gold roll pips: lit = rolls still available. */
export function RollPips({ rollsUsed }: { rollsUsed: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.pips}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.pip,
            i < 3 - rollsUsed
              ? { backgroundColor: colors.goldHi, shadowColor: colors.goldHi, shadowOpacity: 0.8, shadowRadius: 5 }
              : { backgroundColor: 'rgba(255,255,255,0.2)' },
          ]}
        />
      ))}
    </View>
  );
}

/** Big glossy walnut Roll button with the rolls-left badge. */
export function RollButton({
  rollsLeft,
  onPress,
}: {
  rollsLeft: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const disabled = rollsLeft === 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={disabled ? t('game.pickBox') : `${t('game.roll')}, ${t('game.a11yRollsLeft', { count: rollsLeft })}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roll,
        {
          backgroundColor: disabled ? 'rgba(0,0,0,0.25)' : colors.primary,
          borderBottomColor: disabled ? 'transparent' : colors.primaryLo,
          borderTopColor: disabled ? 'transparent' : colors.primaryHi,
        },
        pressed && styles.pressed,
      ]}
    >
      {disabled ? (
        <Text style={[styles.rollLabel, { color: colors.onFelt2 }]}>{t('game.pickBox')}</Text>
      ) : (
        <>
          <Ionicons name="sync" size={20} color={colors.onPrimary} />
          <Text style={[styles.rollLabel, { color: colors.onPrimary }]}>{t('game.roll')}</Text>
          <View style={styles.kbd}>
            <Text style={[styles.kbdText, { color: colors.onPrimary }]}>{t('game.rollsLeft', { count: rollsLeft })}</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

/** Segmented control for whose card the sheet shows. */
export function CardTabs({
  players,
  viewed,
  onSelect,
}: {
  players: readonly PlayerState[];
  viewed: number;
  onSelect: (index: number) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
      <View style={[styles.tabs, { backgroundColor: colors.surface2 }]}>
        {players.map((p, i) => {
          const on = i === viewed;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="tab"
              accessibilityLabel={t('game.viewCard', { name: p.name })}
              accessibilityState={{ selected: on }}
              onPress={() => onSelect(i)}
              hitSlop={4}
              style={[styles.tab, on && { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.tabText, { color: on ? colors.ink : colors.ink2 }]} numberOfLines={1}>
                {p.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.heavy, color: '#FFFFFF' },
  players: { gap: 6, paddingHorizontal: 2 },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    minWidth: 96,
  },
  playerOff: { backgroundColor: 'rgba(0,0,0,0.15)', borderColor: 'transparent' },
  playerName: { fontFamily: fonts.semibold, fontSize: 11, opacity: 0.8, maxWidth: 110 },
  playerPoints: { fontFamily: fonts.heavy, fontSize: 15, fontVariant: ['tabular-nums'] },
  pips: { flexDirection: 'row', gap: 5 },
  pip: { width: 9, height: 9, borderRadius: 5, shadowOffset: { width: 0, height: 0 } },
  roll: {
    flex: 1,
    minHeight: 58,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderBottomWidth: 4,
    borderTopWidth: 1,
  },
  rollLabel: { fontFamily: fonts.bold, fontSize: 17 },
  kbd: { backgroundColor: 'rgba(0,0,0,0.14)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  kbdText: { fontFamily: fonts.semibold, fontSize: 12, fontVariant: ['tabular-nums'] },
  tabsScroll: { flexGrow: 0, flexShrink: 1 },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  tab: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.sm - 1, justifyContent: 'center' },
  tabText: { fontFamily: fonts.bold, fontSize: 12.5 },
});
