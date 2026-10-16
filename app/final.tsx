import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { playerTotal, type GameState } from '../src/engine/game';
import { PRESETS } from '../src/engine/rules/presets';
import { totals } from '../src/engine/scoring';
import { getAppData } from '../src/state/appData';
import { previousBest, winnerIndexes } from '../src/state/gameLog';
import { useGameStore } from '../src/state/gameStore';
import { Button } from '../src/ui/Button';
import { Avatar } from '../src/ui/GameParts';
import { Screen } from '../src/ui/Screen';
import { fonts, radius, space } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';

/** Counts up to `to` over 1.4 s; shows it at once with Reduce Motion. */
function useCountUp(to: number): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduceMotion) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const p = Math.min(1, (Date.now() - startedAt) / 1400);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 4))));
      if (p >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [to, reduceMotion]);
  return reduceMotion ? to : value;
}

function yatzyCount(player: GameState['players'][number]): number {
  return (player.card.yatzy === 50 ? 1 : 0) + player.extraYatzyCount;
}

/**
 * S5 Final scorecard. Always shown first after a game; no ad, prompt or popup
 * may cover it (specs.md F9). Any interstitial comes only after leaving it.
 */
export default function FinalScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const game = useGameStore((s) => s.game);
  const { dismissFinished, start } = useGameStore.getState();
  // Set while Home / Play again is navigating away, so the redirect below stays quiet.
  const [leaving, setLeaving] = useState(false);

  const summary = useMemo(() => {
    if (!game || game.status !== 'finished') return null;
    const scores = game.players.map((_, i) => playerTotal(game, i));
    const winners = winnerIndexes(game);
    const humans = game.players.flatMap((p, i) => (p.kind === 'human' ? [i] : []));
    // The big number belongs to the best-placed human (or the winner in an all-AI table).
    const hero = winners.find((i) => game.players[i].kind === 'human') ?? humans[0] ?? winners[0];
    const best = previousBest(getAppData().gameLog, game);
    const order = scores
      .map((s, i) => [s, i] as const)
      .sort((a, b) => b[0] - a[0])
      .map(([, i]) => i);
    return { scores, winners, humans, hero, order, personalBest: best !== null && scores[hero] > best };
  }, [game]);

  const shown = useCountUp(summary ? summary.scores[summary.hero] : 0);
  if (!game || !summary) return leaving ? null : <Redirect href="/" />;

  const preset = PRESETS[game.preset];
  const { scores, winners, humans, hero, order, personalBest } = summary;
  const solo = game.players.length === 1;
  let headline: string;
  if (solo) headline = t('final.finalScore');
  else if (winners.length > 1) headline = t('final.tie');
  else if (humans.length === 1 && winners[0] === humans[0]) headline = t('final.youWin');
  else headline = t('final.wins', { name: game.players[winners[0]].name });

  const heroPlayer = game.players[hero];
  const heroTotals = totals(preset, heroPlayer.card, heroPlayer.extraYatzyCount);
  const chips: { key: string; value: string; gold?: boolean }[] = [
    { key: 'final.upper', value: String(heroTotals.upper) },
    { key: 'final.bonus', value: heroTotals.upperBonus > 0 ? `+${heroTotals.upperBonus}` : '0', gold: true },
    { key: 'final.lower', value: String(heroTotals.lower + heroTotals.extraYatzyBonus) },
    { key: 'final.yatzysChip', value: String(yatzyCount(heroPlayer)) },
  ];

  function leave(again: boolean) {
    if (!game) return;
    const players = game.players.map(({ card: _card, extraYatzyCount: _extra, ...config }) => config);
    const { preset: presetId, forcedOrder } = game;
    setLeaving(true);
    dismissFinished();
    if (again) {
      start({ players, preset: presetId, forcedOrder });
      router.replace('/game');
    } else {
      router.replace('/');
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.medal, { backgroundColor: colors.gold }]}>
            <Ionicons name="trophy" size={36} color="#7A4E0E" />
          </View>
          <Text accessibilityRole="header" style={[styles.headline, { color: colors.gold }]}>
            {headline.toUpperCase()}
          </Text>
          <Text
            style={[styles.big, { color: colors.ink }]}
            accessibilityLabel={t('game.playerTotal', { name: heroPlayer.name, points: scores[hero] })}
          >
            {shown}
          </Text>
          {personalBest ? (
            <View style={[styles.pb, { backgroundColor: colors.goldHi }]}>
              <Ionicons name="star" size={13} color="#4A2E06" />
              <Text style={styles.pbText}>{t('final.personalBest')}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.rank, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {order.map((i, n) => {
            const p = game.players[i];
            const pt = totals(preset, p.card, p.extraYatzyCount);
            const yatzys = yatzyCount(p);
            const won = winners.includes(i) && !solo;
            const detail = [
              yatzys > 0 ? t('final.yatzys', { count: yatzys }) : null,
              pt.upperBonus > 0 ? t('final.bonusMade') : t('final.noBonus'),
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <View
                key={p.id}
                accessible
                accessibilityLabel={`${won ? `${t('final.winner')}, ` : ''}${p.name}, ${scores[i]}, ${detail}`}
                style={[styles.rankRow, n > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}
              >
                <View>
                  <Avatar player={p} size={34} />
                  {won ? <Ionicons name="ribbon" size={14} color={colors.gold} style={styles.crown} /> : null}
                </View>
                <View style={styles.rankName}>
                  <Text style={[styles.name, { color: colors.ink }]}>{p.name}</Text>
                  <Text style={[styles.detail, { color: colors.ink2 }]}>{detail}</Text>
                </View>
                <Text style={[styles.rankScore, { color: winners.includes(i) ? colors.ink : colors.ink2 }]}>
                  {scores[i]}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.chips}>
          {chips.map(({ key, value, gold }) => (
            <View
              key={key}
              accessible
              accessibilityLabel={`${t(key)} ${value}`}
              style={[
                styles.chip,
                gold
                  ? { backgroundColor: colors.goldSoft, borderColor: 'transparent' }
                  : { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <Text style={[styles.chipLabel, { color: colors.ink3 }]}>{t(key).toUpperCase()}</Text>
              <Text style={[styles.chipValue, { color: gold ? colors.gold : colors.ink }]}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button label={t('final.home')} onPress={() => leave(false)} />
          </View>
          <View style={styles.flex2}>
            <Button variant="primary" label={t('final.playAgain')} onPress={() => leave(true)} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingVertical: space.lg },
  hero: { alignItems: 'center', paddingTop: space.sm },
  medal: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
    shadowColor: '#C9952B',
    shadowOpacity: 0.8,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  headline: { fontFamily: fonts.heavy, fontSize: 11.5, letterSpacing: 2, marginTop: 14 },
  big: { fontFamily: fonts.display, fontSize: 84, letterSpacing: -3, fontVariant: ['tabular-nums'] },
  pb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  pbText: { fontFamily: fonts.bold, fontSize: 12.5, color: '#4A2E06' },
  rank: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 4 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  crown: { position: 'absolute', top: -10, alignSelf: 'center' },
  rankName: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 14 },
  detail: { fontFamily: fonts.body, fontSize: 12 },
  rankScore: { fontFamily: fonts.heavy, fontSize: 19, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', gap: space.sm },
  chip: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center' },
  chipLabel: { fontFamily: fonts.heavy, fontSize: 9, letterSpacing: 0.9 },
  chipValue: { fontFamily: fonts.heavy, fontSize: 17, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  flex: { flex: 1 },
  flex2: { flex: 2 },
});
