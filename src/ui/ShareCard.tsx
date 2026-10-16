import { forwardRef, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { GameState } from '../engine/game';
import { PRESETS } from '../engine/rules/presets';
import { totals } from '../engine/scoring';
import { DieFace } from './Die';
import { Felt } from './Felt';
import { fonts } from './tokens';
import { useTheme } from './theme';

/** Logical size; captured at 3× for the 1080×1350 share image (specs.md S8). */
export const SHARE_CARD_SIZE = { width: 360, height: 450 } as const;

export interface ShareCardData {
  daily: boolean;
  score: number;
  /** Already formatted for display. */
  date: string;
  /** The score breakdown, when the finished game is at hand. */
  breakdown?: { upper: number; bonus: number; lower: number; yatzys: number };
  /** Shown instead of the breakdown on the daily screen. */
  streak?: number;
}

/** Share data for a finished game: the first person's score, no names. */
export function shareDataFor(game: GameState, date: string): ShareCardData {
  const index = Math.max(0, game.players.findIndex((p) => p.kind === 'human'));
  const p = game.players[index];
  const sum = totals(PRESETS[game.preset], p.card, p.extraYatzyCount);
  return {
    daily: game.mode === 'daily',
    score: sum.total,
    date,
    breakdown: {
      upper: sum.upper,
      bonus: sum.upperBonus,
      lower: sum.lower + sum.extraYatzyBonus,
      yatzys: (p.card.yatzy === 50 ? 1 : 0) + p.extraYatzyCount,
    },
  };
}

/**
 * The image people share. It holds no names or other personal data (F11):
 * just the score, a mini breakdown, the date and the app's address.
 */
export type ShareCardRef = ComponentRef<typeof View>;

export const ShareCard = forwardRef<ShareCardRef, { data: ShareCardData }>(function ShareCard({ data }, ref) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const b = data.breakdown;
  const chips: [string, string][] = b
    ? [
        [t('final.upper'), String(b.upper)],
        [t('final.bonus'), b.bonus > 0 ? `+${b.bonus}` : '0'],
        [t('final.lower'), String(b.lower)],
        [t('final.yatzysChip'), String(b.yatzys)],
      ]
    : data.streak
      ? [[t('stats.streakNow'), t('daily.streak', { count: data.streak })]]
      : [];
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: colors.feltLo }]}>
      <Felt />
      <View style={styles.top}>
        <View style={styles.brand}>
          <View style={styles.tilt}>
            <DieFace value={5} size={26} />
          </View>
          <Text style={styles.brandText}>{t('app.name')}</Text>
        </View>
        <Text style={styles.date}>{data.date}</Text>
      </View>
      <Text style={styles.kind}>{(data.daily ? t('share.daily') : t('share.finalScore')).toUpperCase()}</Text>
      <Text style={styles.score}>{data.score}</Text>
      <View style={styles.dice}>
        {([6, 6, 6, 6, 6] as const).map((v, i) => (
          <View key={i} style={{ transform: [{ rotate: `${(i - 2) * 7}deg` }] }}>
            <DieFace value={v} size={40} />
          </View>
        ))}
      </View>
      <View style={[styles.sheet, { backgroundColor: colors.sheet, opacity: chips.length ? 1 : 0 }]}>
        {chips.map(([label, value]) => (
          <View key={label} style={styles.chip}>
            <Text style={[styles.chipLabel, { color: colors.ink3 }]}>{label.toUpperCase()}</Text>
            <Text style={[styles.chipValue, { color: colors.ink }]}>{value}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.footer}>{t('share.footer')}</Text>
    </View>
  );
});

const INK = '#F4FBF6';
const styles = StyleSheet.create({
  card: { ...SHARE_CARD_SIZE, overflow: 'hidden', padding: 22, alignItems: 'center' },
  top: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tilt: { transform: [{ rotate: '-12deg' }] },
  brandText: { color: INK, fontFamily: fonts.display, fontSize: 18 },
  date: { color: '#CDEBDB', fontFamily: fonts.semibold, fontSize: 12 },
  kind: { color: '#F4CF73', fontFamily: fonts.heavy, fontSize: 12, letterSpacing: 2, marginTop: 34 },
  score: { color: INK, fontFamily: fonts.display, fontSize: 96, letterSpacing: -3, fontVariant: ['tabular-nums'] },
  dice: { flexDirection: 'row', gap: 6, marginTop: 4 },
  sheet: { flexDirection: 'row', alignSelf: 'stretch', borderRadius: 18, paddingVertical: 12, marginTop: 30 },
  chip: { flex: 1, alignItems: 'center' },
  chipLabel: { fontFamily: fonts.heavy, fontSize: 8.5, letterSpacing: 0.9 },
  chipValue: { fontFamily: fonts.heavy, fontSize: 18, fontVariant: ['tabular-nums'] },
  footer: { color: '#CDEBDB', fontFamily: fonts.semibold, fontSize: 12, marginTop: 'auto' },
});
