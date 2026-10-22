import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { interstitialAfterFinal, prepareInterstitial } from '../src/ads';
import { MONETIZATION_ENABLED } from '../src/config/features';
import { shouldShowRemoveAdsCard } from '../src/ads/policy';
import { playerTotal, type GameState } from '../src/engine/game';
import { PRESETS } from '../src/engine/rules/presets';
import { totals } from '../src/engine/scoring';
import { toDateKey } from '../src/engine/rng';
import { getAppData, updateAppData } from '../src/state/appData';
import { dailyDateOf, formatDateKey } from '../src/state/daily';
import { previousBest, winnerIndexes } from '../src/state/gameLog';
import { useGameStore } from '../src/state/gameStore';
import { hasRemoveAds } from '../src/state/shopStore';
import { Button } from '../src/ui/Button';
import { Avatar } from '../src/ui/GameParts';
import { useReduceMotion } from '../src/ui/motion';
import { Screen } from '../src/ui/Screen';
import { shareCard } from '../src/ui/share';
import { ShareCard, shareDataFor, type ShareCardRef } from '../src/ui/ShareCard';
import { fonts, radius, space } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';
import { useAndroidBack } from '../src/ui/useAndroidBack';

/** Counts up to `to` over 1.4 s; shows it at once with Reduce Motion. */
function useCountUp(to: number): number {
  const reduceMotion = useReduceMotion();
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
  const shareRef = useRef<ShareCardRef>(null);
  const newUnlocks = useGameStore((s) => s.newUnlocks);
  // When the scorecard appeared: an interstitial may follow only after 3 s on it.
  const [shownAt] = useState(() => Date.now());
  // The small Remove Ads card, once from game 3 on (specs.md §7.2). Inline, never covering the scorecard.
  const [removeAdsCard] = useState(() => {
    if (game?.status !== 'finished') return false;
    const data = getAppData();
    return MONETIZATION_ENABLED && shouldShowRemoveAdsCard({ ads: data.ads, stats: data.stats, removeAds: hasRemoveAds(), mode: game.mode });
  });
  const finishedMode = game?.status === 'finished' ? game.mode : null;
  useEffect(() => {
    if (finishedMode) void prepareInterstitial(finishedMode);
  }, [finishedMode]);
  useEffect(() => {
    if (removeAdsCard) updateAppData((d) => ({ ...d, ads: { ...d.ads, removeAdsCardShown: true } }));
  }, [removeAdsCard]);

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

  // Android Back from the scorecard means Home, through the same exit as the button.
  useAndroidBack(() => void leave(false));

  const shown = useCountUp(summary ? summary.scores[summary.hero] : 0);
  if (!game || !summary) return leaving ? null : <Redirect href="/" />;

  const preset = PRESETS[game.preset];
  const { scores, winners, humans, hero, order, personalBest } = summary;
  const solo = game.players.length === 1;
  const daily = game.mode === 'daily';
  let headline: string;
  if (daily) headline = t('final.dailyTitle');
  else if (solo) headline = t('final.finalScore');
  else if (winners.length > 1) headline = t('final.tie');
  else if (humans.length === 1 && winners[0] === humans[0]) headline = t('final.youWin');
  else headline = t('final.wins', { name: game.players[winners[0]].name });

  const heroPlayer = game.players[hero];
  // With several players, say whose score the big number is: it may not be the winner's.
  const heroCaption =
    solo || daily ? null : heroPlayer.name === t('players.you') ? t('final.yourScore') : t('final.playerScore', { name: heroPlayer.name });
  const heroTotals = totals(preset, heroPlayer.card, heroPlayer.extraYatzyCount);
  const chips: { key: string; value: string; gold?: boolean }[] = [
    { key: 'final.upper', value: String(heroTotals.upper) },
    { key: 'final.bonus', value: heroTotals.upperBonus > 0 ? `+${heroTotals.upperBonus}` : '0', gold: true },
    { key: 'final.lower', value: String(heroTotals.lower + heroTotals.extraYatzyBonus) },
    { key: 'final.yatzysChip', value: String(yatzyCount(heroPlayer)) },
  ];

  async function leave(again: boolean) {
    if (!game || leaving) return;
    const players = game.players.map(({ card: _card, extraYatzyCount: _extra, ...config }) => config);
    const { preset: presetId, forcedOrder, mode } = game;
    setLeaving(true);
    // The only interstitial placement: after leaving S5, before the next screen.
    // Resolves at once when no ad is due or ready, so leaving is never held up.
    await interstitialAfterFinal(mode, Date.now() - shownAt);
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
          {heroCaption ? <Text style={[styles.caption, { color: colors.ink2 }]}>{heroCaption}</Text> : null}
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

        {newUnlocks.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.goldSoft, borderColor: colors.gold }]}>
            <Ionicons name="sparkles" size={20} color={colors.gold} />
            <Text style={[styles.cardText, { color: colors.ink }]}>
              {t('final.unlocked', { name: newUnlocks.map((id) => t(`shop.skins.${id}`)).join(', ') })}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/shop')} style={styles.cardButton}>
              <Text style={[styles.cardLink, { color: colors.primary }]}>{t('final.unlockedCta')}</Text>
            </Pressable>
          </View>
        ) : null}
        {removeAdsCard ? (
          <View testID="remove-ads-card" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('final.removeAdsTitle')}</Text>
              <Text style={[styles.cardText, { color: colors.ink2 }]}>{t('final.removeAdsBody')}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/shop')} style={styles.cardButton}>
              <Text style={[styles.cardLink, { color: colors.primary }]}>{t('final.removeAdsCta')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('final.share')}
            onPress={() => void shareCard(shareRef)}
            style={[styles.share, { backgroundColor: colors.surface, borderColor: colors.line }]}
          >
            <Ionicons name="share-social" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.flex}>
            <Button variant={daily ? 'primary' : 'secondary'} label={t('final.home')} disabled={leaving} onPress={() => void leave(false)} />
          </View>
          {/* The daily dice are one try a day; there is no Play again. */}
          {daily ? null : (
            <View style={styles.flex2}>
              <Button variant="primary" label={t('final.playAgain')} disabled={leaving} onPress={() => void leave(true)} />
            </View>
          )}
        </View>
      </ScrollView>
      <View style={styles.offscreen} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <ShareCard ref={shareRef} data={shareDataFor(game, formatDateKey(dailyDateOf(game.id) ?? toDateKey(new Date())))} />
      </View>
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
  caption: { fontFamily: fonts.semibold, fontSize: 14, marginTop: -6, marginBottom: space.sm },
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
  share: { width: 56, minHeight: 56, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: 18, padding: space.md, flexWrap: 'wrap' },
  cardBody: { flex: 1, minWidth: 160, gap: 2 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 14.5 },
  cardText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, flexShrink: 1 },
  cardButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  cardLink: { fontFamily: fonts.bold, fontSize: 14 },
});
