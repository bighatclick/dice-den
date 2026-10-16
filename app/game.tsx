import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MAX_ROLLS } from '../src/engine/dice';
import { playerTotal, scoreOptions } from '../src/engine/game';
import { PRESETS } from '../src/engine/rules/presets';
import { getAppData } from '../src/state/appData';
import { useGameStore } from '../src/state/gameStore';
import { Die } from '../src/ui/Die';
import { holdFeedback, rollFeedback, scoreFeedback } from '../src/ui/feedback';
import { Felt } from '../src/ui/Felt';
import { CardTabs, GlassButton, PlayerBar, RollButton, RollPips } from '../src/ui/GameParts';
import { ScorePad } from '../src/ui/ScorePad';
import { fonts, space } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';

const SOLO_PLAYER_COLOR = '#C77D4E';

/** S3 Game table. No ads can appear here, ever (CLAUDE.md rule 1). */
export default function GameScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const game = useGameStore((s) => s.game);
  const rollSeq = useGameStore((s) => s.rollSeq);
  const { start, roll, toggleHold, score, undo } = useGameStore.getState();
  // Whose card the sheet shows; snaps back to the current player when the turn passes.
  const [picked, setPicked] = useState<{ turnOf: number; index: number } | null>(null);
  const settings = getAppData().settings;

  // "Play" with nothing in progress starts a solo game (the new-game sheet arrives with AI and pass-and-play).
  useEffect(() => {
    if (!game) start({ players: [{ id: 'p1', name: t('players.you'), kind: 'human', color: SOLO_PLAYER_COLOR }] });
  }, [game, start, t]);

  useEffect(() => {
    if (game?.status === 'finished') router.replace('/final');
  }, [game?.status]);

  const current = game?.current ?? 0;
  const viewed = picked?.turnOf === current ? picked.index : current;
  const setViewed = (index: number) => setPicked({ turnOf: current, index });

  useEffect(() => {
    if (rollSeq > 0 && game) AccessibilityInfo.announceForAccessibility(t('game.a11yRolled', { dice: game.dice.join(', ') }));
    // Announce once per roll only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollSeq]);

  if (!game || game.status === 'finished') return <View style={[styles.root, { backgroundColor: colors.feltLo }]} />;

  const preset = PRESETS[game.preset];
  const totals = game.players.map((_, i) => playerTotal(game, i));
  const viewedPlayer = game.players[Math.min(viewed, game.players.length - 1)];
  const viewingCurrent = viewedPlayer === game.players[game.current];
  const rolled = game.rollsUsed > 0;
  const canHold = rolled && game.rollsUsed < MAX_ROLLS;
  const rollsLeft = MAX_ROLLS - game.rollsUsed;
  const wide = width > height && width >= 640;

  function confirmLeave() {
    Alert.alert(t('game.leaveTitle'), t('game.leaveBody'), [
      { text: t('game.stay'), style: 'cancel' },
      { text: t('game.leaveConfirm'), onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) },
    ]);
  }

  const table = (
    <View style={wide ? styles.tableWide : undefined}>
      <View style={styles.feltZone}>
        <View style={styles.rollInfo}>
          <Text style={[styles.rollInfoText, { color: colors.onFelt2 }]}>
            {rolled
              ? t('game.turnRoll', { turn: game.round, roll: game.rollsUsed })
              : t('game.turnStart', { turn: game.round })}
          </Text>
          <RollPips rollsUsed={game.rollsUsed} />
        </View>
        <View style={styles.dice}>
          {game.dice.map((value, i) => (
            <Die
              key={i}
              index={i}
              value={value}
              held={game.held[i]}
              canHold={canHold}
              rolled={rolled}
              rollSeq={rollSeq}
              size={settings.largeDice ? 62 : 54}
              highContrast={settings.highContrastPips}
              onToggle={(index) => {
                holdFeedback();
                toggleHold(index);
              }}
            />
          ))}
        </View>
        <Text style={[styles.hint, { color: colors.onFelt2 }]}>
          {t(!rolled ? 'game.hintFirst' : canHold ? 'game.hintHold' : 'game.hintLast')}
        </Text>
      </View>
      <View style={[styles.actions, settings.leftHanded && styles.actionsLeft]}>
        <RollButton
          rollsLeft={rollsLeft}
          onPress={() => {
            rollFeedback();
            roll();
          }}
        />
        {game.undo ? <GlassButton icon="arrow-undo" label={t('game.undo')} onPress={undo} size={58} /> : null}
      </View>
    </View>
  );

  const sheet = (
    <View style={[styles.sheet, wide && styles.sheetWide, { backgroundColor: colors.sheet }]}>
      <View style={[styles.grab, { backgroundColor: colors.line }]} />
      <View style={styles.sheetHead}>
        {game.players.length > 1 ? (
          <CardTabs players={game.players} viewed={viewed} onSelect={setViewed} />
        ) : (
          <Text style={[styles.sheetName, { color: colors.ink }]}>{viewedPlayer.name}</Text>
        )}
        <View style={styles.total} accessible accessibilityLabel={`${t('game.total')} ${totals[game.players.indexOf(viewedPlayer)]}`}>
          <Text style={[styles.totalLabel, { color: colors.ink3 }]}>{t('game.total').toUpperCase()}</Text>
          <Text style={[styles.totalValue, { color: colors.ink }]}>{totals[game.players.indexOf(viewedPlayer)]}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.padScroll}>
        <ScorePad
          preset={preset}
          card={viewedPlayer.card}
          extraYatzyCount={viewedPlayer.extraYatzyCount}
          options={viewingCurrent ? scoreOptions(game) : {}}
          hints={settings.hints}
          onScore={
            viewingCurrent
              ? (box) => {
                  scoreFeedback();
                  score(box);
                }
              : undefined
          }
        />
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.feltLo }]}>
      <Felt />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.bar}>
          <GlassButton icon="chevron-back" label={t('game.leave')} onPress={confirmLeave} />
          <View style={styles.barPlayers}>
            <PlayerBar players={game.players} current={game.current} totals={totals} />
          </View>
        </View>
        <View style={[styles.body, wide && styles.bodyWide]}>
          {table}
          {sheet}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: 14, paddingTop: 2 },
  barPlayers: { flex: 1 },
  body: { flex: 1 },
  bodyWide: { flexDirection: 'row', gap: space.lg, paddingLeft: 14 },
  tableWide: { flex: 1, justifyContent: 'center' },
  feltZone: { paddingHorizontal: 14, paddingTop: 14, alignItems: 'center' },
  rollInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rollInfoText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', fontVariant: ['tabular-nums'] },
  dice: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 30, marginBottom: 6 },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, opacity: 0.85, marginBottom: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 14 },
  actionsLeft: { flexDirection: 'row-reverse' },
  sheet: {
    flex: 1,
    marginTop: 14,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 8,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -10 },
    elevation: 12,
  },
  sheetWide: { marginTop: 0, borderTopRightRadius: 0, borderTopLeftRadius: 30, maxWidth: 520 },
  grab: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginBottom: space.sm },
  sheetName: { fontFamily: fonts.bold, fontSize: 15 },
  total: { alignItems: 'flex-end' },
  totalLabel: { fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 1.2 },
  totalValue: { fontFamily: fonts.display, fontSize: 24, fontVariant: ['tabular-nums'] },
  padScroll: { paddingBottom: 34 },
});
