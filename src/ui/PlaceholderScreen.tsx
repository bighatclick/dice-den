import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { Button } from './Button';
import { Screen } from './Screen';
import { type, space } from './tokens';
import { useTheme } from './theme';

/** Temporary screen body until the screen's build phase (specs.md §15). */
export function PlaceholderScreen({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Screen>
      <Text accessibilityRole="header" style={[type.hero, styles.title, { color: colors.ink }]}>
        {t(titleKey)}
      </Text>
      <Text style={[type.body, { color: colors.ink2 }]}>{t('common.comingSoon')}</Text>
      <Button label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.xl },
});
