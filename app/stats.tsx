import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Face } from '../src/engine/dice';
import { toDateKey } from '../src/engine/rng';
import { getAppData } from '../src/state/appData';
import { currentStreak } from '../src/state/daily';
import { computeStats, facePercents, type StatsFilter } from '../src/state/stats';
import { DieFace } from '../src/ui/Die';
import { Screen } from '../src/ui/Screen';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { Segmented } from '../src/ui/Segmented';
import { fonts, radius, space } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';

const FAIR = 100 / 6;
const LEVELS = ['easy', 'normal', 'expert'] as const;

/** Bars per face against the fair 16.7% line (specs.md §4.3, S6). */
function FaceChart({ title, counts, color }: { title: string; counts: readonly number[]; color: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const percents = facePercents(counts);
  const total = counts.reduce((a, b) => a + b, 0);
  // Scale so the fair line sits at 60% of the bar height, leaving room for variance.
  const scale = (p: number) => Math.min(100, (p / FAIR) * 60);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.muted, { color: colors.ink2 }]}>{t('stats.rolls', { count: total })}</Text>
      </View>
      <View style={styles.chart}>
        {percents.map((p, i) => (
          <View
            key={i}
            style={styles.barCol}
            accessible
            accessibilityLabel={t('stats.facePercent', { face: i + 1, percent: p.toFixed(1), count: counts[i] })}
          >
            <Text style={[styles.barPct, { color: colors.ink2 }]}>{total ? `${p.toFixed(1)}%` : '–'}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { height: `${scale(p)}%`, backgroundColor: color }]} />
              {/* The fair 16.7% mark. */}
              <View style={[styles.fairLine, { borderColor: colors.gold }]} />
            </View>
            <DieFace value={(i + 1) as Face} size={22} />
          </View>
        ))}
      </View>
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label} ${value}`} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Text style={[styles.tileLabel, { color: colors.ink3 }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.tileValue, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

/** S6 Stats, all computed on the device from the game log (specs.md F7). */
export default function StatsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<StatsFilter>('all');
  const data = getAppData();
  const stats = useMemo(() => computeStats(data.gameLog, filter), [data.gameLog, filter]);
  const streak = currentStreak(data.daily, toDateKey(new Date()));
  const dash = t('stats.noGames');

  return (
    <Screen>
      <ScreenHeader title={t('stats.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Segmented
          label={t('stats.filter')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('stats.all') },
            { value: 'classic', label: t('newGame.classic') },
            { value: 'scandinavian', label: t('newGame.scandinavian') },
          ]}
        />
        {stats.games === 0 ? <Text style={[styles.empty, { color: colors.ink2 }]}>{t('stats.empty')}</Text> : null}
        <View style={styles.tiles}>
          <Tile label={t('stats.games')} value={String(stats.games)} />
          <Tile label={t('stats.highScore')} value={stats.highScore === null ? dash : String(stats.highScore)} />
          <Tile label={t('stats.average')} value={stats.average === null ? dash : String(stats.average)} />
          <Tile label={t('stats.yatzys')} value={String(stats.yatzys)} />
          <Tile label={t('stats.bonusRate')} value={stats.bonusRate === null ? dash : `${Math.round(stats.bonusRate * 100)}%`} />
          <Tile label={t('stats.dailyGames')} value={String(stats.daily)} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('stats.vsComputer')}</Text>
          {LEVELS.map((level) => (
            <View key={level} style={[styles.row, { borderTopColor: colors.line }]} accessible>
              <Text style={[styles.rowLabel, { color: colors.ink }]}>{t(`players.computer_${level}`)}</Text>
              <Text style={[styles.rowValue, { color: colors.ink2 }]}>
                {stats.vs[level].played === 0 ? dash : t('stats.record', { ...stats.vs[level] })}
              </Text>
            </View>
          ))}
          <View style={[styles.row, { borderTopColor: colors.line }]} accessible>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>{t('stats.passAndPlay')}</Text>
            <Text style={[styles.rowValue, { color: colors.ink2 }]}>{stats.passAndPlay}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('stats.daily')}</Text>
          <View style={[styles.row, { borderTopColor: colors.line }]} accessible>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>{t('stats.streakNow')}</Text>
            <Text style={[styles.rowValue, { color: colors.ink2 }]}>{t('daily.streak', { count: streak })}</Text>
          </View>
          <View style={[styles.row, { borderTopColor: colors.line }]} accessible>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>{t('stats.streakBest')}</Text>
            <Text style={[styles.rowValue, { color: colors.ink2 }]}>{t('daily.streak', { count: data.daily.bestStreak })}</Text>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.ink }]}>{t('stats.fairness')}</Text>
        <Text style={[styles.muted, { color: colors.ink2 }]}>{t('stats.fairnessBody')}</Text>
        <FaceChart title={t('stats.you')} counts={stats.humanFaces} color={colors.primary} />
        <FaceChart title={t('stats.computer')} counts={stats.aiFaces} color={colors.accent} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingVertical: space.md },
  empty: { fontFamily: fonts.medium, fontSize: 15, textAlign: 'center', paddingVertical: space.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexGrow: 1, flexBasis: '30%', borderWidth: 1, borderRadius: radius.lg, padding: space.md, alignItems: 'center' },
  tileLabel: { fontFamily: fonts.heavy, fontSize: 9.5, letterSpacing: 0.9, textAlign: 'center' },
  tileValue: { fontFamily: fonts.heavy, fontSize: 20, fontVariant: ['tabular-nums'], marginTop: 2 },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: space.lg, gap: space.sm },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, borderTopWidth: 1, gap: space.md },
  rowLabel: { fontFamily: fonts.medium, fontSize: 14.5, flexShrink: 1 },
  rowValue: { fontFamily: fonts.semibold, fontSize: 14, fontVariant: ['tabular-nums'] },
  section: { fontFamily: fonts.display, fontSize: 20, marginTop: space.sm },
  chart: { flexDirection: 'row', height: 170, gap: space.sm, paddingTop: space.sm },
  fairLine: { position: 'absolute', left: -4, right: -4, bottom: '60%', borderTopWidth: 2, borderStyle: 'dashed' },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barPct: { fontFamily: fonts.semibold, fontSize: 10, fontVariant: ['tabular-nums'] },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
});
