import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space } from './tokens';
import { useTheme } from './theme';

/** Widest the content of a regular screen gets, in points (iPad and tablets). */
export const CONTENT_MAX_WIDTH = 720;

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }, style]} edges={['top', 'bottom', 'left', 'right']}>
      {/* On tablets the content keeps a readable width instead of stretching edge to edge. */}
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.lg },
  content: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', gap: space.md },
});
