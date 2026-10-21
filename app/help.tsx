import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { isUpperBox, PRESETS, upperFace, type PresetId } from '../src/engine/rules/presets';
import { useSettings } from '../src/state/settingsStore';
import { Screen } from '../src/ui/Screen';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { Segmented } from '../src/ui/Segmented';
import { fonts, radius, space } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';

const TURN = ['roll', 'keep', 'score', 'once', 'undo', 'end'] as const;
const FAQ = ['fair', 'daily', 'streak', 'closed', 'rules', 'friends', 'ads', 'restore', 'offline'] as const;

/**
 * How to play and FAQ, in plain English. The box list comes from the rule presets,
 * so it always matches the score pad; the points in each line match src/engine/scoring.ts.
 */
export default function HelpScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const settings = useSettings();
  const [presetId, setPresetId] = useState<PresetId>(settings.preset);
  const preset = PRESETS[presetId];

  const heading = (text: string) => (
    <Text accessibilityRole="header" style={[styles.h2, { color: colors.ink }]}>
      {text}
    </Text>
  );
  const body = { color: colors.ink2 };

  return (
    <Screen>
      <ScreenHeader title={t('help.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        {heading(t('help.turnTitle'))}
        {TURN.map((step, i) => (
          <View key={step} style={styles.step}>
            <Text style={[styles.stepNo, { color: colors.accent }]}>{i + 1}</Text>
            <Text style={[styles.p, styles.flex, body]}>{t(`help.turn.${step}`)}</Text>
          </View>
        ))}

        {heading(t('help.boxesTitle'))}
        <Segmented
          label={t('help.rulesLabel')}
          value={presetId}
          onChange={setPresetId}
          options={[
            { value: 'classic', label: t('newGame.classic') },
            { value: 'scandinavian', label: t('newGame.scandinavian') },
          ]}
        />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {preset.boxes.map((box) => (
            <View key={box} style={[styles.box, { borderBottomColor: colors.line }]} accessible>
              <Text style={[styles.boxName, { color: colors.ink }]}>{t(`boxes.${box}`)}</Text>
              <Text style={[styles.p, body]}>
                {isUpperBox(box) ? t('help.upper', { face: upperFace(box) }) : t(`help.${presetId}.${box}`)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[styles.p, body]}>{t('help.bonus', { bonus: preset.upperBonus })}</Text>
        {preset.extraYatzyBonus > 0 ? <Text style={[styles.p, body]}>{t('help.classic.extra')}</Text> : null}
        <Text style={[styles.p, body]}>{t('help.forcedOrder')}</Text>

        {heading(t('help.faqTitle'))}
        {FAQ.map((item) => (
          <View key={item} style={styles.faq} accessible>
            <Text style={[styles.q, { color: colors.ink }]}>{t(`help.faq.${item}.q`)}</Text>
            <Text style={[styles.p, body]}>{t(`help.faq.${item}.a`)}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingVertical: space.lg },
  flex: { flex: 1 },
  h2: { fontFamily: fonts.display, fontSize: 22, marginTop: space.sm },
  p: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  step: { flexDirection: 'row', gap: space.sm },
  stepNo: { fontFamily: fonts.heavy, fontSize: 16, lineHeight: 24, minWidth: 18, fontVariant: ['tabular-nums'] },
  card: { borderRadius: radius.md, paddingHorizontal: space.md },
  box: { paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  boxName: { fontFamily: fonts.bold, fontSize: 16 },
  faq: { gap: space.xs },
  q: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24 },
});
