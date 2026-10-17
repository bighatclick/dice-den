import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, radius, space, touchTarget } from './tokens';
import { useTheme } from './theme';

type Variant = 'primary' | 'secondary';

export function Button({
  label,
  onPress,
  variant = 'secondary',
  subtitle,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  subtitle?: string;
  disabled?: boolean;
  /** Overrides the spoken label when the visible one needs context. */
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${label}, ${subtitle}` : label)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary
          ? { backgroundColor: colors.primary, borderBottomWidth: 4, borderBottomColor: colors.primaryLo }
          : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View>
        <Text style={[styles.label, { color: primary ? colors.onPrimary : colors.ink }]}>{label}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: primary ? colors.onPrimary : colors.ink2 }]}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Math.max(touchTarget, 56),
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  label: { fontFamily: fonts.bold, fontSize: 17 },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, marginTop: 2, opacity: 0.85 },
});
