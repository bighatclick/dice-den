import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, touchTarget, type } from './tokens';
import { useTheme } from './theme';

/** Back button and title for the secondary screens. */
export function ScreenHeader({ title }: { title: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.line }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.ink} />
      </Pressable>
      <Text accessibilityRole="header" style={[type.title, styles.title, { color: colors.ink }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  back: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1 },
});
