import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PlayerState } from '../engine/game';
import { fonts, radius, space } from './tokens';

const BG = '#0E1B26';
const INK = '#EEF5FA';

/**
 * S4 Pass handoff: covers the table so the next person never sees the last
 * player's dice. No ad may ever appear here (CLAUDE.md rule 1).
 */
export function Handoff({
  next,
  previous,
  players,
  totals,
  turn,
  turns,
  onStart,
  onUndo,
}: {
  next: PlayerState;
  previous: PlayerState;
  players: readonly PlayerState[];
  totals: readonly number[];
  turn: number;
  turns: number;
  onStart: () => void;
  /** Present while the previous player can still take back their score. */
  onUndo?: () => void;
}) {
  const { t } = useTranslation();
  const top = Math.max(1, ...totals);
  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.pill}>
            <Ionicons name="eye-off" size={13} color={INK} />
            <Text style={styles.pillText}>{t('handoff.hidden', { name: previous.name, turn, turns })}</Text>
          </View>
          <View style={[styles.orb, { backgroundColor: next.color, shadowColor: next.color }]}>
            <Text style={styles.orbText}>{next.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={styles.label}>{t('handoff.passTo')}</Text>
          <Text accessibilityRole="header" style={styles.name}>
            {next.name}
          </Text>
          <Text style={styles.text}>{t('handoff.body', { name: previous.name })}</Text>

          <View style={styles.standings} accessible accessibilityLabel={`${t('handoff.standings')}: ${players.map((p, i) => `${p.name} ${totals[i]}`).join(', ')}`}>
            {players.map((p, i) => (
              <View key={p.id} style={styles.standing}>
                <View style={[styles.mini, { backgroundColor: p.color }]}>
                  <Text style={styles.miniText}>{p.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={styles.standingName} numberOfLines={1}>
                  {p.name}
                </Text>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${(totals[i] / top) * 100}%`, backgroundColor: p.color }]} />
                </View>
                <Text style={styles.points}>{totals[i]}</Text>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('handoff.start', { name: next.name })}
            onPress={onStart}
            style={({ pressed }) => [styles.start, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="finger-print" size={20} color={BG} />
            <Text style={styles.startText}>{t('handoff.start', { name: next.name })}</Text>
          </Pressable>
          {onUndo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('handoff.undo', { name: previous.name })}
              onPress={onUndo}
              style={styles.undo}
            >
              <Ionicons name="arrow-undo" size={15} color={INK} />
              <Text style={styles.undoText}>{t('handoff.undo', { name: previous.name })}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BG, zIndex: 10 },
  safe: { flex: 1 },
  body: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pillText: { color: INK, fontFamily: fonts.semibold, fontSize: 12, fontVariant: ['tabular-nums'] },
  orb: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
    shadowOpacity: 0.7,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  orbText: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 44 },
  label: { color: INK, opacity: 0.7, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
  name: { color: INK, fontFamily: fonts.display, fontSize: 40, letterSpacing: -1, textAlign: 'center' },
  text: { color: INK, opacity: 0.75, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  standings: {
    alignSelf: 'stretch',
    gap: 10,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  standing: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mini: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  miniText: { color: '#FFFFFF', fontFamily: fonts.heavy, fontSize: 11 },
  standingName: { color: INK, fontFamily: fonts.semibold, fontSize: 13, width: 72 },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  points: { color: INK, fontFamily: fonts.heavy, fontSize: 14, minWidth: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },
  start: {
    alignSelf: 'stretch',
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: space.md,
  },
  startText: { color: BG, fontFamily: fonts.bold, fontSize: 17 },
  undo: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.md },
  undoText: { color: INK, opacity: 0.8, fontFamily: fonts.semibold, fontSize: 14 },
});
