import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ensureAdsReady } from '../src/ads';
import { requestTracking } from '../src/ads/att';
import { shouldOfferAtt } from '../src/ads/policy';
import { playerTotal } from '../src/engine/game';
import { PRESETS } from '../src/engine/rules/presets';
import { toDateKey } from '../src/engine/rng';
import { getAppData } from '../src/state/appData';
import { addDays, currentStreak, formatDateKey } from '../src/state/daily';
import { useGameStore } from '../src/state/gameStore';
import { useSettings } from '../src/state/settingsStore';
import { computeStats } from '../src/state/stats';
import { DieFace } from '../src/ui/Die';
import { Felt } from '../src/ui/Felt';
import { Button } from '../src/ui/Button';
import { Avatar } from '../src/ui/GameParts';
import { Screen } from '../src/ui/Screen';
import { fonts, radius, space, touchTarget } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';

function greetingKey(hour: number): string {
  if (hour < 12) return 'home.morning';
  if (hour < 18) return 'home.afternoon';
  return 'home.evening';
}

function IconButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.line }, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
    </Pressable>
  );
}

/** S1 Home (approved v2 design). No ads on this screen, ever. */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const game = useGameStore((s) => s.game);
  const { onboardingDone } = useSettings();
  // ATT soft prompt: iOS, once, after the 3rd session, never mid-game (CLAUDE.md rule 7).
  const [offerAtt, setOfferAtt] = useState(() => {
    const { ads, stats } = getAppData();
    return onboardingDone && shouldOfferAtt({ ads, stats, platform: Platform.OS, inGame: false });
  });
  // UMP consent and SDK start, once per launch and only after the first run.
  // Nothing is ever shown here: interstitials appear only after a final scorecard.
  useEffect(() => {
    if (onboardingDone && !offerAtt) void ensureAdsReady();
  }, [onboardingDone, offerAtt]);

  async function continueToAtt() {
    await requestTracking();
    setOfferAtt(false);
  }

  // First launch: the practice turn and rules picker (S11), skippable.
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  const resuming = game?.status === 'playing';
  const now = new Date();
  const today = toDateKey(now);
  const data = getAppData();
  const daily = data.daily;
  const streak = currentStreak(daily, today);
  const dailyStatus = [
    daily.results[today] !== undefined ? t('home.dailyDone', { score: daily.results[today] }) : t('home.dailySubtitle'),
    streak > 0 ? t('home.dailyStreak', { count: streak }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const stats = computeStats(data.gameLog);
  const statsLine = stats.highScore === null ? t('home.statsEmpty') : t('home.statsSubtitle', { best: stats.highScore, count: stats.games });
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  const turns = game ? PRESETS[game.preset].boxes.length : 13;
  const rules = game ? t(`newGame.${game.preset}`) : '';
  const others = game?.players
    .slice(1)
    .map((p) => p.name)
    .join(', ');
  const playLabel = resuming ? t('home.resume') : t('home.play');
  const playSubtitle = resuming ? t('home.resumeSubtitle', { turn: game.round, turns }) : undefined;

  return (
    <Screen>
      <Modal visible={offerAtt} transparent animationType="fade" onRequestClose={() => void continueToAtt()}>
        <View style={styles.scrim}>
          <View style={[styles.attCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="shield-checkmark-outline" size={30} color={colors.accent} />
            <Text accessibilityRole="header" style={[styles.attTitle, { color: colors.ink }]}>
              {t('att.title')}
            </Text>
            <Text style={[styles.attBody, { color: colors.ink2 }]}>{t('att.body')}</Text>
            <View style={styles.attButton}>
              <Button variant="primary" label={t('att.continue')} onPress={() => void continueToAtt()} />
            </View>
          </View>
        </View>
      </Modal>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.logo, { backgroundColor: colors.primaryLo }]}>
            <View style={styles.logoDie}>
              <DieFace value={5} size={26} />
            </View>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.greeting, { color: colors.ink2 }]}>{t(greetingKey(now.getHours()))}</Text>
            <Text accessibilityRole="header" style={[styles.appName, { color: colors.ink }]}>
              {t('app.name')}
            </Text>
          </View>
          <IconButton icon="help-circle-outline" label={t('home.help')} onPress={() => router.push('/help')} />
          <IconButton icon="storefront-outline" label={t('home.shop')} onPress={() => router.push('/shop')} />
          <IconButton icon="settings-outline" label={t('home.settings')} onPress={() => router.push('/settings')} />
        </View>

        <View style={[styles.table, { backgroundColor: colors.felt }]}>
          <Felt />
          <View style={styles.tableDice} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={styles.bigDie}>
              <DieFace value={6} size={64} />
            </View>
            <View style={styles.sideDie}>
              <DieFace value={5} size={42} />
            </View>
          </View>
          <View style={styles.eyebrowRow}>
            {resuming ? <View style={[styles.live, { backgroundColor: colors.mint }]} /> : null}
            <Text style={[styles.eyebrow, { color: colors.onFelt2 }]}>
              {(resuming ? t('home.inProgress') : t('home.ready')).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.tableTitle, { color: colors.onFelt }]}>{resuming ? t('home.continue') : t('home.readyTitle')}</Text>
          <Text style={[styles.tableSub, { color: colors.onFelt2 }]}>
            {resuming ? (others ? t('home.versus', { names: others, rules }) : t('home.solo', { rules })) : t('home.readySub')}
          </Text>
          {resuming ? (
            <>
              <View style={styles.scoreline}>
                {game.players.slice(0, 3).map((p, i) => (
                  <View key={p.id} style={[styles.scoreChip, i === game.current && { borderColor: colors.goldHi }]}>
                    <Avatar player={p} size={22} />
                    <Text style={[styles.scoreName, { color: colors.onFelt, maxWidth: 90 * Math.max(1, fontScale) }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={[styles.scoreValue, { color: colors.onFelt }]}>{playerTotal(game, i)}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.turnBar} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {Array.from({ length: turns }, (_, i) => (
                  <View key={i} style={[styles.turnDot, { backgroundColor: i < game.round - 1 ? colors.goldHi : 'rgba(255,255,255,0.18)' }]} />
                ))}
              </View>
            </>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playSubtitle ? `${playLabel}, ${playSubtitle}` : playLabel}
            onPress={() => router.push(game?.status === 'finished' ? '/final' : resuming ? '/game' : '/new-game')}
            style={({ pressed }) => [styles.play, pressed && styles.pressed]}
          >
            <Ionicons name="play" size={18} color="#4A230F" />
            <Text style={styles.playText}>{playLabel}</Text>
            {playSubtitle ? (
              <View style={styles.kbd}>
                <Text style={styles.kbdText}>{t('home.turnOf', { turn: game?.round, turns })}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('home.daily')}, ${dailyStatus}`}
          onPress={() => router.push('/daily')}
          style={({ pressed }) => [styles.daily, { backgroundColor: colors.surface, borderColor: colors.gold }, pressed && styles.pressed]}
        >
          <View style={styles.dailyRow}>
            <View style={[styles.cal, { borderColor: colors.line }]}>
              <Text maxFontSizeMultiplier={1.5} style={[styles.calMonth, { color: colors.danger }]}>{formatDateKey(today, { month: 'short' }).toUpperCase()}</Text>
              <Text maxFontSizeMultiplier={1.5} style={[styles.calDay, { color: colors.ink }]}>{now.getDate()}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[styles.dailyTitle, { color: colors.ink }]}>{t('home.daily')}</Text>
              <Text style={[styles.dailySub, { color: colors.ink2 }]}>{dailyStatus}</Text>
            </View>
            <View style={[styles.flame, { backgroundColor: streak > 0 ? colors.primary : colors.surface2 }]}>
              <Ionicons name="flame" size={16} color={streak > 0 ? '#FFFFFF' : colors.ink3} />
              <Text style={[styles.flameText, { color: streak > 0 ? '#FFFFFF' : colors.ink3 }]}>{streak}</Text>
            </View>
          </View>
          <View style={styles.week}>
            {week.map((date) => {
              const done = daily.results[date] !== undefined;
              return (
                <View
                  key={date}
                  style={[
                    styles.weekDay,
                    { backgroundColor: done ? colors.accent : colors.surface2 },
                    date === today && !done && { borderColor: colors.primary, borderWidth: 2 },
                  ]}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.weekLetter, { color: colors.ink3 }]}>{formatDateKey(date, { weekday: 'narrow' })}</Text>
                  )}
                </View>
              );
            })}
          </View>
        </Pressable>

        <View style={styles.tiles}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('home.passAndPlay')}, ${t('home.passAndPlaySubtitle')}`}
            onPress={() => router.push({ pathname: '/new-game', params: { opponents: 'pass' } })}
            style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.line }, pressed && styles.pressed]}
          >
            <View style={[styles.tileIcon, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="people" size={20} color={colors.accent} />
            </View>
            <Text style={[styles.tileTitle, { color: colors.ink }]}>{t('home.passAndPlay')}</Text>
            <Text style={[styles.tileSub, { color: colors.ink2 }]}>{t('home.passAndPlaySubtitle')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.stats')}
            accessibilityHint={statsLine}
            onPress={() => router.push('/stats')}
            style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.line }, pressed && styles.pressed]}
          >
            <View style={[styles.tileIcon, { backgroundColor: colors.goldSoft }]}>
              <Ionicons name="stats-chart" size={20} color={colors.gold} />
            </View>
            <Text style={[styles.tileTitle, { color: colors.ink }]}>{t('home.stats')}</Text>
            <Text style={[styles.tileSub, { color: colors.ink2 }]}>{statsLine}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingVertical: space.sm },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logo: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoDie: { transform: [{ rotate: '-12deg' }] },
  greeting: { fontFamily: fonts.medium, fontSize: 12.5 },
  appName: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.4 },
  iconBtn: { width: touchTarget, height: touchTarget, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  table: { borderRadius: 30, padding: 18, overflow: 'hidden', minHeight: 250, gap: 4 },
  tableDice: { position: 'absolute', right: 22, top: 50, alignItems: 'flex-end' },
  bigDie: { transform: [{ rotate: '14deg' }] },
  sideDie: { marginTop: -6, marginRight: 52, transform: [{ rotate: '-18deg' }] },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  live: { width: 8, height: 8, borderRadius: 4 },
  eyebrow: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 1.4 },
  tableTitle: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.6, marginTop: space.sm },
  tableSub: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, maxWidth: '60%' },
  scoreline: { flexDirection: 'row', gap: 6, marginTop: space.md, flexWrap: 'wrap' },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  scoreName: { fontFamily: fonts.semibold, fontSize: 12 },
  scoreValue: { fontFamily: fonts.heavy, fontSize: 14, fontVariant: ['tabular-nums'] },
  turnBar: { flexDirection: 'row', gap: 3, marginTop: space.md },
  turnDot: { flex: 1, height: 5, borderRadius: 3 },
  play: {
    marginTop: space.lg,
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: '#FFF4E2',
    borderBottomWidth: 4,
    borderBottomColor: '#E2CDA8',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    rowGap: 4,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  playText: { fontFamily: fonts.bold, fontSize: 17, color: '#4A230F' },
  kbd: { backgroundColor: 'rgba(122,62,29,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  kbdText: { fontFamily: fonts.semibold, fontSize: 12, color: '#4A230F', fontVariant: ['tabular-nums'] },
  daily: { borderRadius: 22, borderWidth: 1.5, padding: 14, gap: 12 },
  dailyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cal: { minWidth: 46, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1, alignItems: 'center', paddingVertical: 4 },
  calMonth: { fontFamily: fonts.heavy, fontSize: 9.5, letterSpacing: 0.8 },
  calDay: { fontFamily: fonts.display, fontSize: 20, fontVariant: ['tabular-nums'] },
  dailyTitle: { fontFamily: fonts.bold, fontSize: 16 },
  dailySub: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  flame: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14 },
  flameText: { fontFamily: fonts.heavy, fontSize: 16, fontVariant: ['tabular-nums'] },
  week: { flexDirection: 'row', gap: 6 },
  weekDay: { flex: 1, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  weekLetter: { fontFamily: fonts.bold, fontSize: 11 },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderRadius: 22, borderWidth: 1, padding: 14, gap: 6, minHeight: 120 },
  tileIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileTitle: { fontFamily: fonts.bold, fontSize: 14.5 },
  tileSub: { fontFamily: fonts.body, fontSize: 12 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: space.xl },
  attCard: { borderRadius: radius.xl, padding: space.xl, gap: space.md, alignItems: 'center' },
  attTitle: { fontFamily: fonts.display, fontSize: 22, textAlign: 'center' },
  attBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  attButton: { alignSelf: 'stretch', marginTop: space.sm },
});
