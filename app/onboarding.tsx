import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Face } from '../src/engine/dice';
import type { PresetId } from '../src/engine/rules/presets';
import { useSettings, useSettingsStore } from '../src/state/settingsStore';
import { Button } from '../src/ui/Button';
import { Die } from '../src/ui/Die';
import { Felt } from '../src/ui/Felt';
import { RollButton } from '../src/ui/GameParts';
import { CONTENT_MAX_WIDTH } from '../src/ui/Screen';
import { Segmented } from '../src/ui/Segmented';
import { fonts, radius, space } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';
import { LightStatusBar } from '../src/ui/LightStatusBar';

/**
 * The practice turn uses fixed dice so it always teaches the same thing.
 * It is a demo, not a game: nothing here is scored or saved.
 */
const DEMO_FIRST: Face[] = [5, 2, 5, 6, 5];
const DEMO_SECOND: Face[] = [5, 5, 5, 6, 5];
const DEMO_BOXES = [
  { box: 'fives', points: 20 },
  { box: 'fourKind', points: 26 },
  { box: 'chance', points: 26 },
] as const;

type Step = 'welcome' | 'roll' | 'hold' | 'score' | 'done' | 'rules';

/** S11 First run: one practice turn and the rules picker. Skippable; asks for no permissions. */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const settings = useSettings();
  const [step, setStep] = useState<Step>('welcome');
  const [dice, setDice] = useState<Face[]>(DEMO_FIRST);
  const [held, setHeld] = useState([false, false, false, false, false]);
  const [rollSeq, setRollSeq] = useState(0);
  const [preset, setPreset] = useState<PresetId>(settings.preset);

  const fivesHeld = dice.every((d, i) => (d === 5) === held[i]);
  const finish = (chosen: PresetId = settings.preset) => {
    useSettingsStore.getState().update({ onboardingDone: true, preset: chosen });
    router.replace('/');
  };

  const instruction =
    step === 'roll' ? t('onboarding.step1') : step === 'hold' ? t('onboarding.step2') : step === 'score' ? t('onboarding.step3') : t('onboarding.done');

  return (
    <View style={[styles.root, { backgroundColor: colors.feltLo }]}>
      <Felt />
      <LightStatusBar />
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <Text style={[styles.badge, { color: colors.onFelt2 }]}>{step === 'welcome' || step === 'rules' ? '' : t('onboarding.demo').toUpperCase()}</Text>
          {step !== 'rules' ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('onboarding.skip')} onPress={() => finish()} style={styles.skip}>
              <Text style={[styles.skipText, { color: colors.onFelt }]}>{t('onboarding.skip')}</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {step === 'welcome' ? (
            <>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.onFelt }]}>
                {t('onboarding.welcome')}
              </Text>
              <Text style={[styles.text, { color: colors.onFelt2 }]}>{t('onboarding.intro')}</Text>
              <Button variant="primary" label={t('onboarding.showMe')} onPress={() => setStep('roll')} />
            </>
          ) : step === 'rules' ? (
            <View style={[styles.sheet, { backgroundColor: colors.sheet }]}>
              <Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.ink }]}>
                {t('onboarding.rulesTitle')}
              </Text>
              <Text style={[styles.sheetText, { color: colors.ink2 }]}>{t('onboarding.rulesBody')}</Text>
              <Segmented
                label={t('onboarding.rulesTitle')}
                value={preset}
                onChange={setPreset}
                options={[
                  { value: 'classic', label: t('newGame.classic'), subtitle: t('newGame.classicSubtitle') },
                  { value: 'scandinavian', label: t('newGame.scandinavian'), subtitle: t('newGame.scandinavianSubtitle') },
                ]}
              />
              <Button variant="primary" label={t('onboarding.start')} onPress={() => finish(preset)} />
            </View>
          ) : (
            <>
              <Text accessibilityLiveRegion="polite" style={[styles.text, { color: colors.onFelt }]}>
                {instruction}
              </Text>
              <View style={styles.dice}>
                {dice.map((value, i) => (
                  <Die
                    key={i}
                    index={i}
                    value={value}
                    held={held[i]}
                    canHold={step === 'hold'}
                    rolled={step !== 'roll'}
                    rollSeq={rollSeq}
                    onToggle={(index) => setHeld((h) => h.map((x, j) => (j === index ? !x : x)))}
                  />
                ))}
              </View>
              {step === 'roll' || step === 'hold' ? (
                <View style={styles.action}>
                  <RollButton
                    rollsLeft={step === 'roll' ? 3 : 2}
                    disabled={step === 'hold' && !fivesHeld}
                    label={step === 'hold' ? t('onboarding.step2Roll') : undefined}
                    onPress={() => {
                      setRollSeq((n) => n + 1);
                      if (step === 'roll') {
                        setStep('hold');
                      } else {
                        setDice(DEMO_SECOND);
                        setHeld([false, false, false, false, false]);
                        setStep('score');
                      }
                    }}
                  />
                </View>
              ) : null}
              {step === 'score' || step === 'done' ? (
                <View style={[styles.sheet, { backgroundColor: colors.sheet }]}>
                  {DEMO_BOXES.map(({ box, points }) => (
                    <Pressable
                      key={box}
                      accessibilityRole="button"
                      accessibilityLabel={t('pad.a11yOption', { box: t(`boxes.${box}`), points })}
                      disabled={step !== 'score'}
                      onPress={() => setStep('done')}
                      style={[styles.box, { borderBottomColor: colors.line }]}
                    >
                      <Text style={[styles.boxLabel, { color: colors.ink }]}>{t(`boxes.${box}`)}</Text>
                      <Text style={[styles.boxPoints, { color: colors.accent }]}>{points}</Text>
                    </Pressable>
                  ))}
                  {step === 'done' ? <Button variant="primary" label={t('onboarding.next')} onPress={() => setStep('rules')} /> : null}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, minHeight: 48 },
  badge: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 1.4 },
  skip: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  skipText: { fontFamily: fonts.bold, fontSize: 15 },
  body: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 34, textAlign: 'center' },
  text: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 25, textAlign: 'center' },
  dice: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  action: { flexDirection: 'row' },
  sheet: { borderRadius: radius.xl, padding: space.lg, gap: space.md },
  sheetTitle: { fontFamily: fonts.display, fontSize: 24 },
  sheetText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  box: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  boxLabel: { fontFamily: fonts.semibold, fontSize: 15.5 },
  boxPoints: { fontFamily: fonts.heavy, fontSize: 16, fontVariant: ['tabular-nums'] },
});
