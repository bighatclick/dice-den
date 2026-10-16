import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import type { Face } from '../engine/dice';
import { isUpperBox, upperFace, type BoxId, type RulePreset } from '../engine/rules/presets';
import { totals, type Scorecard } from '../engine/scoring';
import { PIPS } from './Die';
import { fonts, radius, space, type } from './tokens';
import { useTheme } from './theme';

function MiniDie({ value, color }: { value: Face; color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 100 100">
      <Rect x="5" y="5" width="90" height="90" rx="24" fill="none" stroke={color} strokeWidth={8} opacity={0.55} />
      {PIPS[value].map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={10} fill={color} />
      ))}
    </Svg>
  );
}

/** The box (or first of tied boxes) worth the most right now: highlighted as the suggestion. */
export function bestOption(options: Scorecard): BoxId | null {
  let best: BoxId | null = null;
  for (const [box, value] of Object.entries(options) as [BoxId, number][]) {
    if (best === null || value > (options[best] ?? 0)) best = box;
  }
  return best;
}

interface ScorePadProps {
  preset: RulePreset;
  card: Scorecard;
  extraYatzyCount: number;
  /** Boxes the current player may score in now, with their points. Empty when viewing someone else. */
  options: Scorecard;
  hints: boolean;
  onScore?: (box: BoxId) => void;
}

export function ScorePad({ preset, card, extraYatzyCount, options, hints, onScore }: ScorePadProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  // Large text gets one column so labels never truncate (specs.md §10).
  const twoColumns = fontScale <= 1.3 && width >= 340;
  const sum = totals(preset, card, extraYatzyCount);
  const best = hints ? bestOption(options) : null;
  const upper = preset.boxes.filter(isUpperBox);
  const lower = preset.boxes.filter((b) => !isUpperBox(b));
  const bonusProgress = Math.min(1, sum.upper / preset.upperBonusThreshold);

  function row(box: BoxId) {
    const scored = card[box];
    const option = options[box];
    const allowed = option !== undefined && onScore !== undefined;
    const name = t(`boxes.${box}`);
    const isBest = allowed && box === best;
    let a11y: string;
    if (scored !== undefined) a11y = t('pad.a11yScored', { box: name, points: scored });
    else if (allowed && hints) a11y = t('pad.a11yOption', { box: name, points: option });
    else if (allowed) a11y = t('pad.a11yOpen', { box: name });
    else a11y = t('pad.a11yEmpty', { box: name });

    return (
      <Pressable
        key={box}
        accessibilityRole={allowed ? 'button' : undefined}
        accessibilityLabel={a11y}
        disabled={!allowed}
        onPress={() => onScore?.(box)}
        testID={`box-${box}`}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: colors.line },
          isBest && { backgroundColor: colors.accentSoft, borderColor: colors.accent, borderWidth: 1.5, borderBottomWidth: 1.5 },
          pressed && { opacity: 0.6 },
        ]}
      >
        <View style={styles.label}>
          {isUpperBox(box) ? <MiniDie value={upperFace(box) as Face} color={colors.ink2} /> : null}
          <Text
            style={[
              styles.labelText,
              { color: colors.ink },
              box === 'yatzy' && styles.yatzyLabel,
              isBest && styles.bestLabel,
            ]}
          >
            {name}
          </Text>
        </View>
        {scored !== undefined ? (
          <Text style={[type.score, styles.value, { color: colors.ink }]}>{scored}</Text>
        ) : allowed && hints ? (
          <Text
            style={[
              styles.hint,
              { color: isBest ? colors.accent : colors.ink3, opacity: option === 0 ? 0.5 : 1 },
              isBest && styles.bestHint,
            ]}
          >
            {option}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={[styles.grid, twoColumns && styles.gridTwo]}>
      <View style={styles.column}>
        <Text style={[type.eyebrow, styles.heading, { color: colors.ink3 }]}>{t('pad.upper')}</Text>
        {upper.map(row)}
        <View
          style={[styles.bonus, { backgroundColor: colors.goldSoft }]}
          accessible
          accessibilityLabel={
            sum.upperBonus > 0
              ? t('pad.a11yBonusMade', { bonus: preset.upperBonus })
              : t('pad.a11yBonus', { bonus: preset.upperBonus, upper: sum.upper, target: preset.upperBonusThreshold })
          }
        >
          <View style={styles.bonusText}>
            <Text style={[styles.bonusLabel, { color: colors.gold }]}>{t('pad.bonus', { bonus: preset.upperBonus })}</Text>
            <Text style={[styles.bonusLabel, { color: colors.gold }]}>
              {sum.upperBonus > 0 ? t('pad.bonusMade') : `${sum.upper}/${preset.upperBonusThreshold}`}
            </Text>
          </View>
          <View style={[styles.bar, { backgroundColor: 'rgba(201,149,43,0.22)' }]}>
            <View style={[styles.barFill, { width: `${bonusProgress * 100}%`, backgroundColor: colors.gold }]} />
          </View>
        </View>
      </View>
      <View style={styles.column}>
        <Text style={[type.eyebrow, styles.heading, { color: colors.ink3 }]}>{t('pad.lower')}</Text>
        {lower.map(row)}
        {sum.extraYatzyBonus > 0 ? (
          <View style={[styles.row, { borderBottomColor: colors.line }]}>
            <Text style={[styles.labelText, { color: colors.gold }]}>{t('pad.extraYatzys', { count: extraYatzyCount })}</Text>
            <Text style={[type.score, styles.value, { color: colors.gold }]}>+{sum.extraYatzyBonus}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.sm },
  gridTwo: { flexDirection: 'row', gap: space.md },
  column: { flex: 1 },
  heading: { paddingHorizontal: 6, paddingVertical: space.xs },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    borderColor: 'transparent',
  },
  label: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  labelText: { fontFamily: fonts.medium, fontSize: 13.5 },
  yatzyLabel: { fontFamily: fonts.display },
  bestLabel: { fontFamily: fonts.bold },
  value: { fontSize: 15 },
  hint: { fontFamily: fonts.semibold, fontSize: 14, fontVariant: ['tabular-nums'] },
  bestHint: { fontFamily: fonts.heavy },
  bonus: { marginTop: 6, paddingHorizontal: space.sm, paddingVertical: 7, borderRadius: 11 },
  bonusText: { flexDirection: 'row', justifyContent: 'space-between' },
  bonusLabel: { fontFamily: fonts.bold, fontSize: 11.5, fontVariant: ['tabular-nums'] },
  bar: { height: 6, borderRadius: 3, marginTop: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
});
