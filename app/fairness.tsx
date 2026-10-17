import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/ui/Button';
import { DieFace } from '../src/ui/Die';
import { Screen } from '../src/ui/Screen';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { fonts, space } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';

/**
 * Settings › How the dice work: the plain-language fairness page (specs.md §4.3).
 * Keep it in step with src/engine/rng.ts (CLAUDE.md rule 2).
 */
export default function FairnessScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Screen>
      <ScreenHeader title={t('fairness.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.dice} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {([1, 2, 3, 4, 5, 6] as const).map((v) => (
            <DieFace key={v} value={v} size={40} />
          ))}
        </View>
        {(['p1', 'p2', 'p3', 'p4', 'p5'] as const).map((k) => (
          <Text key={k} style={[styles.p, { color: colors.ink }]}>
            {t(`fairness.${k}`)}
          </Text>
        ))}
        <Button label={t('fairness.seeStats')} onPress={() => router.push('/stats')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.lg, paddingVertical: space.lg },
  dice: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  p: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
});
