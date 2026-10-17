import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { toDateKey } from '../src/engine/rng';
import { enableDailyReminder } from '../src/notifications/reminder';
import { getAppData, updateAppData } from '../src/state/appData';
import { currentStreak, dailyDateOf, dailyHistory, formatDateKey } from '../src/state/daily';
import { useGameStore } from '../src/state/gameStore';
import { SEAT_COLORS } from '../src/state/players';
import { useSettingsStore } from '../src/state/settingsStore';
import { Button } from '../src/ui/Button';
import { Screen } from '../src/ui/Screen';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { shareCard } from '../src/ui/share';
import { ShareCard, type ShareCardRef } from '../src/ui/ShareCard';
import { fonts, radius, space } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';

/**
 * S7 Daily dice: one seeded game a day, the same dice for everyone. The first
 * finish is the day's result. No ads ever appear inside the daily dice.
 */
export default function DailyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const game = useGameStore((s) => s.game);
  const shareRef = useRef<ShareCardRef>(null);
  const today = toDateKey(new Date());
  const daily = getAppData().daily;
  const result = daily.results[today];
  const streak = currentStreak(daily, today);
  const history = dailyHistory(daily, today);
  const best = Object.values(daily.results).reduce<number | null>((m, s) => (m === null || s > m ? s : m), null);
  // Ask about the reminder once, after the 2nd daily completion (specs.md F13).
  const [askReminder, setAskReminder] = useState(
    () => Object.keys(daily.results).length >= 2 && !daily.reminderAsked && !useSettingsStore.getState().settings.dailyReminder.enabled,
  );
  const reminderHour = 19;
  async function answerReminder(yes: boolean) {
    setAskReminder(false);
    updateAppData((d) => ({ ...d, daily: { ...d.daily, reminderAsked: true } }));
    if (!yes) return;
    const on = await enableDailyReminder(reminderHour, 0, { title: t('reminder.title'), body: t('reminder.body') });
    useSettingsStore.getState().update({ dailyReminder: { enabled: on, hour: reminderHour, minute: 0 } });
  }
  const todayInProgress = game?.status === 'playing' && game.mode === 'daily' && dailyDateOf(game.id) === today;

  function play() {
    const begin = () => {
      useGameStore.getState().startDaily(today, { id: 'p1', name: t('players.you'), kind: 'human', color: SEAT_COLORS[0] });
      router.push('/game');
    };
    if (game?.status !== 'playing') return begin();
    Alert.alert(t('daily.replaceTitle'), t('daily.replaceBody'), [
      { text: t('newGame.cancel'), style: 'cancel' },
      { text: t('daily.play'), style: 'destructive', onPress: begin },
    ]);
  }

  return (
    <Screen>
      <ScreenHeader title={t('daily.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: colors.felt }]}>
          <Text style={[styles.date, { color: colors.onFelt2 }]}>{formatDateKey(today, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          <Text style={[styles.subtitle, { color: colors.onFelt }]}>{t('daily.subtitle')}</Text>
          <View style={styles.streakRow} accessible accessibilityLabel={`${t('daily.streak', { count: streak })}, ${t('daily.best', { count: daily.bestStreak })}`}>
            <Ionicons name="flame" size={22} color={streak > 0 ? colors.goldHi : colors.onFelt2} />
            <Text style={[styles.streak, { color: colors.onFelt }]}>{t('daily.streak', { count: streak })}</Text>
            <Text style={[styles.best, { color: colors.onFelt2 }]}>{t('daily.best', { count: daily.bestStreak })}</Text>
          </View>
          <Text style={[styles.freeze, { color: colors.onFelt2 }]}>{t('daily.freezeInfo')}</Text>
        </View>

        {result !== undefined ? (
          <View style={[styles.result, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.resultLabel, { color: colors.ink3 }]}>{t('daily.yourScore').toUpperCase()}</Text>
            <Text style={[styles.resultScore, { color: colors.ink }]}>{result}</Text>
            <Text style={[styles.locked, { color: colors.ink2 }]}>{t('daily.locked')}</Text>
            <Button label={t('daily.share')} onPress={() => void shareCard(shareRef)} />
          </View>
        ) : (
          <Button variant="primary" label={todayInProgress ? t('daily.resume') : t('daily.play')} onPress={todayInProgress ? () => router.push('/game') : play} />
        )}
        {askReminder ? (
          <View style={[styles.result, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Text style={[styles.askTitle, { color: colors.ink }]}>{t('reminder.askTitle')}</Text>
            <Text style={[styles.locked, { color: colors.ink2 }]}>
              {t('reminder.askBody', { time: new Date(2026, 0, 1, reminderHour).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) })}
            </Text>
            <View style={styles.askRow}>
              <View style={styles.flex}>
                <Button label={t('reminder.askNo')} onPress={() => void answerReminder(false)} />
              </View>
              <View style={styles.flex}>
                <Button variant="primary" label={t('reminder.askYes')} onPress={() => void answerReminder(true)} />
              </View>
            </View>
          </View>
        ) : null}
        {best !== null ? <Text style={[styles.bestScore, { color: colors.ink2 }]}>{t('daily.bestScore', { score: best })}</Text> : null}

        <Text style={[styles.calendarTitle, { color: colors.ink3 }]}>{t('daily.calendar').toUpperCase()}</Text>
        <View style={styles.calendar}>
          {history.map(({ date, score }) => (
            <View
              key={date}
              accessible
              accessibilityLabel={
                score === null
                  ? t('daily.dayMissed', { date: formatDateKey(date) })
                  : t('daily.dayDone', { date: formatDateKey(date), score })
              }
              style={[
                styles.day,
                score === null
                  ? { backgroundColor: colors.surface2 }
                  : { backgroundColor: colors.goldSoft, borderColor: colors.gold, borderWidth: 1.5 },
                date === today && { borderColor: colors.primary, borderWidth: 2 },
              ]}
            >
              <Text style={[styles.dayNum, { color: score === null ? colors.ink3 : colors.gold }]}>{Number(date.slice(8))}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {result !== undefined ? (
        <View style={styles.offscreen} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <ShareCard ref={shareRef} data={{ daily: true, score: result, date: formatDateKey(today), streak }} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingVertical: space.md },
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.xs },
  date: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  subtitle: { fontFamily: fonts.display, fontSize: 22 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  streak: { fontFamily: fonts.heavy, fontSize: 17 },
  best: { fontFamily: fonts.semibold, fontSize: 13, marginLeft: 'auto' },
  freeze: { fontFamily: fonts.body, fontSize: 12.5 },
  result: { borderWidth: 1, borderRadius: radius.xl, padding: space.lg, alignItems: 'center', gap: space.sm },
  resultLabel: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 1.4 },
  resultScore: { fontFamily: fonts.display, fontSize: 56, fontVariant: ['tabular-nums'] },
  locked: { fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  bestScore: { fontFamily: fonts.medium, fontSize: 13, textAlign: 'center' },
  calendarTitle: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 1.4, marginTop: space.sm },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { width: '12.5%', aspectRatio: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  dayNum: { fontFamily: fonts.bold, fontSize: 13, fontVariant: ['tabular-nums'] },
  askTitle: { fontFamily: fonts.bold, fontSize: 16 },
  askRow: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' },
  flex: { flex: 1 },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
});
