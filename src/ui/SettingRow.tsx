import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { fonts, radius, space, touchTarget } from './tokens';
import { useTheme } from './theme';

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.ink3 }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>{children}</View>
    </View>
  );
}

export function ToggleRow({
  label,
  subtitle,
  value,
  onChange,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <View style={styles.text}>
        <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.ink2 }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={subtitle}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.ink3 }}
      />
    </View>
  );
}

export function LinkRow({ label, onPress, icon = 'chevron-forward' }: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed && { opacity: 0.6 }]}
    >
      <Text style={[styles.label, styles.text, { color: colors.ink }]}>{label}</Text>
      <Ionicons name={icon} size={18} color={colors.ink3} />
    </Pressable>
  );
}

/** A row holding any control (e.g. a segmented picker) under its label. */
export function StackRow({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stack, { borderBottomColor: colors.line }]}>
      <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.xs },
  groupTitle: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 1.3, paddingHorizontal: space.xs },
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    minHeight: touchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stack: { gap: space.sm, padding: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1 },
  label: { fontFamily: fonts.semibold, fontSize: 15.5 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
});
