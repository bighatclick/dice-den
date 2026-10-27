import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { AiLevel } from '../src/engine/game';
import type { PresetId } from '../src/engine/rules/presets';
import { getAppData } from '../src/state/appData';
import { useGameStore } from '../src/state/gameStore';
import { useSettingsStore } from '../src/state/settingsStore';
import { buildPlayers, lastTable, SEAT_COLORS, type Opponents, type SeatDraft, type TableDraft } from '../src/state/players';
import { Button } from '../src/ui/Button';
import { Screen } from '../src/ui/Screen';
import { Segmented } from '../src/ui/Segmented';
import { fonts, radius, space, touchTarget, type } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';
import { confirm } from '../src/ui/ConfirmDialog';

const MAX_SEATS = 6;
const LEVELS: AiLevel[] = ['easy', 'normal', 'expert'];

function initialDraft(param: string | undefined): TableDraft {
  const draft = lastTable(getAppData().gameLog);
  const opponents: Opponents = param === 'pass' ? 'pass' : draft.opponents;
  let seats = draft.seats;
  if (seats.length < 2 || seats.filter((s) => s.kind === 'human').length < 1) {
    seats = [
      { kind: 'human', name: '', aiLevel: 'normal' },
      { kind: 'human', name: '', aiLevel: 'normal' },
    ];
  }
  return { ...draft, opponents, seats };
}

/** S2 New game sheet: opponents, rules preset and forced order. Remembers the last table. */
export default function NewGameScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ opponents?: string }>();
  const [draft, setDraft] = useState<TableDraft>(() => initialDraft(params.opponents));
  const [preset, setPreset] = useState<PresetId>(() => getAppData().settings.preset);
  const [forcedOrder, setForcedOrder] = useState(() => getAppData().settings.forcedOrder);

  const levelOptions = LEVELS.map((l) => ({ value: l, label: t(`newGame.${l}`) }));
  const setSeat = (i: number, change: Partial<SeatDraft>) =>
    setDraft((d) => ({ ...d, seats: d.seats.map((s, j) => (j === i ? { ...s, ...change } : s)) }));
  const humans = draft.seats.filter((s) => s.kind === 'human').length;
  const canStart = draft.opponents !== 'pass' || (draft.seats.length >= 2 && humans >= 1);

  function confirmStart() {
    if (useGameStore.getState().game?.status !== 'playing') return startGame();
    confirm(t('newGame.replaceTitle'), t('newGame.replaceBody'), [
      { text: t('newGame.cancel'), style: 'cancel' },
      { text: t('newGame.replaceConfirm'), style: 'destructive', onPress: startGame },
    ]);
  }

  function startGame() {
    const players = buildPlayers(draft, {
      you: t('players.you'),
      computer: (level) => t(`players.computer_${level}`),
      seat: (n) => t('newGame.defaultName', { n }),
    });
    useSettingsStore.getState().update({ preset, forcedOrder });
    useGameStore.getState().start({ players, preset, forcedOrder });
    router.replace('/game');
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[type.title, { color: colors.ink }]}>
          {t('newGame.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('newGame.close')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={[styles.close, { backgroundColor: colors.surface2 }]}
        >
          <Ionicons name="close" size={20} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.eyebrow, { color: colors.ink3 }]}>{t('newGame.opponents')}</Text>
        <Segmented
          label={t('newGame.opponents')}
          value={draft.opponents}
          onChange={(opponents) => setDraft((d) => ({ ...d, opponents }))}
          options={[
            { value: 'solo', label: t('newGame.solo') },
            { value: 'computer', label: t('newGame.vsComputer') },
            { value: 'pass', label: t('newGame.passAndPlay') },
          ]}
        />

        {draft.opponents === 'computer' ? (
          <>
            <Text style={[type.eyebrow, { color: colors.ink3 }]}>{t('newGame.level')}</Text>
            <Segmented
              label={t('newGame.level')}
              value={draft.aiLevel}
              onChange={(aiLevel) => setDraft((d) => ({ ...d, aiLevel }))}
              options={levelOptions}
            />
          </>
        ) : null}

        {draft.opponents === 'pass' ? (
          <>
            <Text style={[type.eyebrow, { color: colors.ink3 }]}>{t('newGame.players')}</Text>
            {draft.seats.map((seat, i) => {
              const name = seat.kind === 'ai' ? t(`players.computer_${seat.aiLevel}`) : seat.name || t('newGame.defaultName', { n: i + 1 });
              return (
                <View key={i} style={[styles.seat, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <View style={styles.seatTop}>
                    <View style={[styles.dot, { backgroundColor: SEAT_COLORS[i] }]} />
                    {seat.kind === 'human' ? (
                      <TextInput
                        accessibilityLabel={t('newGame.playerName', { n: i + 1 })}
                        value={seat.name}
                        onChangeText={(text) => setSeat(i, { name: text })}
                        placeholder={t('newGame.defaultName', { n: i + 1 })}
                        placeholderTextColor={colors.ink3}
                        maxLength={16}
                        autoCapitalize="words"
                        style={[styles.input, { color: colors.ink, borderColor: colors.line }]}
                      />
                    ) : (
                      <Text style={[styles.seatName, { color: colors.ink }]}>{name}</Text>
                    )}
                    {draft.seats.length > 2 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('newGame.remove', { name })}
                        onPress={() => setDraft((d) => ({ ...d, seats: d.seats.filter((_, j) => j !== i) }))}
                        style={styles.remove}
                      >
                        <Ionicons name="remove-circle-outline" size={22} color={colors.danger} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Segmented
                    label={name}
                    value={seat.kind}
                    onChange={(kind) => setSeat(i, { kind })}
                    options={[
                      { value: 'human', label: t('newGame.human') },
                      { value: 'ai', label: t('newGame.computer') },
                    ]}
                  />
                  {seat.kind === 'ai' ? (
                    <Segmented
                      label={t('newGame.level')}
                      value={seat.aiLevel}
                      onChange={(aiLevel) => setSeat(i, { aiLevel })}
                      options={levelOptions}
                    />
                  ) : null}
                </View>
              );
            })}
            {draft.seats.length < MAX_SEATS ? (
              <Button
                label={t('newGame.addPlayer')}
                onPress={() => setDraft((d) => ({ ...d, seats: [...d.seats, { kind: 'human', name: '', aiLevel: d.aiLevel }] }))}
              />
            ) : null}
          </>
        ) : null}

        <Text style={[type.eyebrow, { color: colors.ink3 }]}>{t('newGame.rules')}</Text>
        <Segmented
          label={t('newGame.rules')}
          value={preset}
          onChange={setPreset}
          options={[
            { value: 'classic', label: t('newGame.classic'), subtitle: t('newGame.classicSubtitle') },
            { value: 'scandinavian', label: t('newGame.scandinavian'), subtitle: t('newGame.scandinavianSubtitle') },
          ]}
        />
        <View style={[styles.toggle, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {/* The label toggles the switch too; the switch alone carries the accessibility role. */}
          <Pressable accessible={false} style={styles.flex} onPress={() => setForcedOrder((v) => !v)}>
            <Text style={[styles.toggleLabel, { color: colors.ink }]}>{t('newGame.forcedOrder')}</Text>
            <Text style={[styles.toggleSub, { color: colors.ink2 }]}>{t('newGame.forcedOrderSubtitle')}</Text>
          </Pressable>
          <Switch
            accessibilityLabel={t('newGame.forcedOrder')}
            value={forcedOrder}
            onValueChange={setForcedOrder}
            trackColor={{ true: colors.accent, false: colors.ink3 }}
          />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button variant="primary" label={t('newGame.start')} onPress={confirmStart} disabled={!canStart} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.sm },
  close: { width: touchTarget, height: touchTarget, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  content: { gap: space.md, paddingBottom: space.xl },
  seat: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  seatTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 14, height: 14, borderRadius: 7 },
  input: {
    flex: 1,
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  seatName: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, paddingVertical: space.sm },
  remove: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
  },
  flex: { flex: 1 },
  toggleLabel: { fontFamily: fonts.bold, fontSize: 15 },
  toggleSub: { fontFamily: fonts.body, fontSize: 13 },
  footer: { paddingBottom: space.md },
});
