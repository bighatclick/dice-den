import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, radius, touchTarget } from './tokens';
import { useTheme } from './theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  subtitle?: string;
}

/** Pill segmented control; each segment is a radio button for screen readers. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.group, { backgroundColor: colors.surface2 }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.subtitle ? `${o.label}, ${o.subtitle}` : o.label}
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              on && { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, elevation: 1 },
            ]}
          >
            <Text style={[styles.label, { color: on ? colors.ink : colors.ink2 }]}>{o.label}</Text>
            {o.subtitle ? <Text style={[styles.subtitle, { color: colors.ink3 }]}>{o.subtitle}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.sm + 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  label: { fontFamily: fonts.bold, fontSize: 13.5, textAlign: 'center' },
  subtitle: { fontFamily: fonts.medium, fontSize: 11, marginTop: 1, textAlign: 'center' },
});
