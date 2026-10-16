import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Button } from '../src/ui/Button';
import { Screen } from '../src/ui/Screen';
import { space, type } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';

/** S1 Home. Full v2 design lands in build phase 2; no ads on this screen, ever. */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[type.hero, { color: colors.ink }]}>
          {t('app.name')}
        </Text>
        <Button variant="primary" label={t('home.play')} onPress={() => router.push('/game')} />
        <Button label={t('home.daily')} subtitle={t('home.dailySubtitle')} onPress={() => router.push('/daily')} />
        <Button
          label={t('home.passAndPlay')}
          subtitle={t('home.passAndPlaySubtitle')}
          onPress={() => router.push('/game')}
        />
        <Button label={t('home.stats')} onPress={() => router.push('/stats')} />
        <Button label={t('home.shop')} onPress={() => router.push('/shop')} />
        <Button label={t('home.settings')} onPress={() => router.push('/settings')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingVertical: space.xl },
});
