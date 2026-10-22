import { Alert, Modal, Platform, StyleSheet, Text, View, type AlertButton } from 'react-native';
import { create } from 'zustand';
import { Button } from './Button';
import { fonts, radius, space } from './tokens';
import { useTheme } from './theme';

type Ask = { title: string; body: string; buttons: AlertButton[] };

const useAsk = create<{ ask: Ask | null }>(() => ({ ask: null }));

/**
 * Asks before a step that can't be undone. Phones use the system alert; the browser
 * build has none (the web Alert does nothing), so <ConfirmHost /> shows the question.
 */
export function confirm(title: string, body: string, buttons: AlertButton[]): void {
  if (Platform.OS !== 'web') return Alert.alert(title, body, buttons);
  useAsk.setState({ ask: { title, body, buttons } });
}

/** Renders a pending web question. Mounted once, at the root. */
export function ConfirmHost() {
  const { colors } = useTheme();
  const ask = useAsk((s) => s.ask);
  if (!ask) return null;
  const close = () => useAsk.setState({ ask: null });
  const cancel = ask.buttons.find((b) => b.style === 'cancel');
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        close();
        cancel?.onPress?.();
      }}
    >
      <View style={styles.scrim}>
        <View accessibilityRole="alert" style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
            {ask.title}
          </Text>
          <Text style={[styles.body, { color: colors.ink2 }]}>{ask.body}</Text>
          <View style={styles.buttons}>
            {ask.buttons.map((b) => (
              <Button
                key={b.text}
                label={b.text ?? ''}
                variant={b.style === 'cancel' ? 'secondary' : 'primary'}
                onPress={() => {
                  close();
                  b.onPress?.();
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: space.xl },
  card: { borderRadius: radius.xl, padding: space.xl, gap: space.md, width: '100%', maxWidth: 420, alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 22, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  buttons: { gap: space.sm, marginTop: space.sm },
});
