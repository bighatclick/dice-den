import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PlayerState } from '../engine/game';
import { isUpperBox, type BoxId, type RulePreset } from '../engine/rules/presets';
import { totals, type Scorecard } from '../engine/scoring';
import { bestOption } from './ScorePad';
import { fonts, radius, space, type } from './tokens';
import { useTheme } from './theme';

interface ScoreGridProps {
  preset: RulePreset;
  players: readonly PlayerState[];
  current: number;
  /** Boxes the current player may score in now, with their points. Empty while a computer plays. */
  options: Scorecard;
  hints: boolean;
  onScore?: (box: BoxId) => void;
}

const LABEL_MIN = 118;
const CELL_MIN = 58;

/**
 * Every player's column side by side, for iPad, tablets and landscape (specs.md S3 and §10).
 * Only the current player's column can be tapped; the phone in portrait uses ScorePad with tabs instead.
 */
export function ScoreGrid({ preset, players, current, options, hints, onScore }: ScoreGridProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sums = players.map((p) => totals(preset, p.card, p.extraYatzyCount));
  const best = hints ? bestOption(options) : null;
  const upper = preset.boxes.filter(isUpperBox);
  const lower = preset.boxes.filter((b) => !isUpperBox(b));
  const anyExtra = sums.some((s) => s.extraYatzyBonus > 0);

  const columnStyle = (i: number) => [styles.cell, i === current && { backgroundColor: colors.accentSoft }];

  function boxRow(box: BoxId) {
    const name = t(`boxes.${box}`);
    return (
      <View key={box} style={[styles.row, { borderBottomColor: colors.line }]}>
        <View style={styles.label}>
          <Text style={[styles.labelText, { color: colors.ink }, box === 'yatzy' && styles.yatzyLabel]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {players.map((p, i) => {
          const scored = p.card[box];
          const option = i === current ? options[box] : undefined;
          const allowed = option !== undefined && onScore !== undefined;
          const isBest = allowed && box === best;
          let a11y: string;
          if (scored !== undefined) a11y = t('pad.a11yScored', { box: name, points: scored });
          else if (allowed && hints) a11y = t('pad.a11yOption', { box: name, points: option });
          else if (allowed) a11y = t('pad.a11yOpen', { box: name });
          else a11y = t('pad.a11yEmpty', { box: name });
          // The current player's cells read like the phone pad; other columns say whose they are.
          if (i !== current) a11y = `${p.name}: ${a11y}`;
          return (
            <Pressable
              key={p.id}
              accessibilityRole={allowed ? 'button' : undefined}
              accessibilityLabel={a11y}
              disabled={!allowed}
              onPress={() => onScore?.(box)}
              testID={i === current ? `grid-${box}` : undefined}
              style={({ pressed }) => [
                ...columnStyle(i),
                allowed && { borderColor: colors.accent, borderWidth: 1.5 },
                pressed && { opacity: 0.6 },
              ]}
            >
              {scored !== undefined ? (
                <Text style={[type.score, styles.value, { color: colors.ink }]}>{scored}</Text>
              ) : allowed && hints ? (
                <Text style={[styles.hint, { color: isBest ? colors.accent : colors.ink }, isBest && styles.bestHint]}>{option}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    );
  }

  function summaryRow(key: string, label: string, values: string[], a11y: (i: number) => string, tone: string, strong = false) {
    return (
      <View key={key} style={[styles.row, { borderBottomColor: colors.line }]}>
        <View style={styles.label}>
          <Text style={[strong ? styles.totalLabel : styles.summaryLabel, { color: tone }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        {players.map((p, i) => (
          <View key={p.id} style={columnStyle(i)} accessible accessibilityLabel={a11y(i)}>
            <Text style={[strong ? styles.totalValue : styles.summaryValue, { color: tone }]} numberOfLines={1}>
              {values[i]}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.grid}>
        <View style={styles.row}>
          <View style={styles.label} />
          {players.map((p, i) => (
            <View key={p.id} style={[...columnStyle(i), styles.headCell]} accessible accessibilityLabel={p.name}>
              <View style={[styles.dot, { backgroundColor: p.color }]} />
              <Text style={[styles.headText, { color: i === current ? colors.ink : colors.ink2 }]} numberOfLines={1}>
                {p.name}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[type.eyebrow, styles.heading, { color: colors.ink3 }]}>{t('pad.upper')}</Text>
        {upper.map(boxRow)}
        {summaryRow(
          'bonus',
          t('pad.bonus', { bonus: preset.upperBonus }),
          sums.map((s) => (s.upperBonus > 0 ? `+${s.upperBonus}` : `${s.upper}/${preset.upperBonusThreshold}`)),
          (i) =>
            `${players[i].name}: ${
              sums[i].upperBonus > 0
                ? t('pad.a11yBonusMade', { bonus: preset.upperBonus })
                : t('pad.a11yBonus', { bonus: preset.upperBonus, upper: sums[i].upper, target: preset.upperBonusThreshold })
            }`,
          colors.gold,
        )}
        <Text style={[type.eyebrow, styles.heading, { color: colors.ink3 }]}>{t('pad.lower')}</Text>
        {lower.map(boxRow)}
        {anyExtra
          ? summaryRow(
              'extra',
              t('pad.extraYatzysTitle'),
              sums.map((s) => (s.extraYatzyBonus > 0 ? `+${s.extraYatzyBonus}` : '')),
              (i) => `${players[i].name}: +${sums[i].extraYatzyBonus}`,
              colors.gold,
            )
          : null}
        {summaryRow(
          'total',
          t('game.total'),
          sums.map((s) => String(s.total)),
          (i) => t('game.playerTotal', { name: players[i].name, points: sums[i].total }),
          colors.ink,
          true,
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  grid: { flex: 1, minWidth: '100%' },
  heading: { paddingHorizontal: 6, paddingTop: space.sm, paddingBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderColor: 'transparent' },
  label: { flex: 1.6, minWidth: LABEL_MIN, justifyContent: 'center', paddingHorizontal: space.sm, minHeight: 44 },
  labelText: { fontFamily: fonts.medium, fontSize: 13.5 },
  yatzyLabel: { fontFamily: fonts.display },
  cell: {
    flex: 1,
    minWidth: CELL_MIN,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  headCell: { flexDirection: 'row', gap: 5, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  headText: { fontFamily: fonts.bold, fontSize: 12.5, flexShrink: 1 },
  value: { fontSize: 15 },
  hint: { fontFamily: fonts.semibold, fontSize: 14, fontVariant: ['tabular-nums'] },
  bestHint: { fontFamily: fonts.heavy },
  summaryLabel: { fontFamily: fonts.bold, fontSize: 12 },
  summaryValue: { fontFamily: fonts.bold, fontSize: 12, fontVariant: ['tabular-nums'] },
  totalLabel: { fontFamily: fonts.bold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  totalValue: { fontFamily: fonts.display, fontSize: 20, fontVariant: ['tabular-nums'] },
});
