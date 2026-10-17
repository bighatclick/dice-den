import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { disableDailyReminder, enableDailyReminder } from '../src/notifications/reminder';
import { isReadOnly } from '../src/state/appData';
import { useSettings, useSettingsStore } from '../src/state/settingsStore';
import { Screen } from '../src/ui/Screen';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { Segmented } from '../src/ui/Segmented';
import { LinkRow, SettingsGroup, StackRow, ToggleRow } from '../src/ui/SettingRow';
import { fonts, space } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';

const PRIVACY_URL = 'https://dicedengame.com/privacy';
const TERMS_URL = 'https://dicedengame.com/terms';
const REMINDER_HOURS = ['8', '12', '19', '21'] as const;

function hourLabel(hour: number): string {
  return new Date(2026, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** S10 Settings. Purchases (Restore, Remove Ads) join with the shop. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const settings = useSettings();
  const update = useSettingsStore.getState().update;
  const [reminderDenied, setReminderDenied] = useState(false);

  async function setReminder(enabled: boolean, hour = settings.dailyReminder.hour) {
    if (!enabled) {
      await disableDailyReminder();
      update({ dailyReminder: { ...settings.dailyReminder, enabled: false } });
      return;
    }
    const on = await enableDailyReminder(hour, 0, { title: t('reminder.title'), body: t('reminder.body') });
    setReminderDenied(!on);
    update({ dailyReminder: { enabled: on, hour, minute: 0 } });
  }

  return (
    <Screen>
      <ScreenHeader title={t('settings.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <SettingsGroup title={t('settings.game')}>
          <StackRow label={t('settings.rules')}>
            <Segmented
              label={t('settings.rules')}
              value={settings.preset}
              onChange={(preset) => update({ preset })}
              options={[
                { value: 'classic', label: t('newGame.classic'), subtitle: t('newGame.classicSubtitle') },
                { value: 'scandinavian', label: t('newGame.scandinavian'), subtitle: t('newGame.scandinavianSubtitle') },
              ]}
            />
          </StackRow>
          <ToggleRow label={t('settings.forcedOrder')} subtitle={t('settings.forcedOrderSubtitle')} value={settings.forcedOrder} onChange={(forcedOrder) => update({ forcedOrder })} />
          <ToggleRow label={t('settings.hints')} subtitle={t('settings.hintsSubtitle')} value={settings.hints} onChange={(hints) => update({ hints })} />
          <StackRow label={t('settings.aiSpeed')}>
            <Segmented
              label={t('settings.aiSpeed')}
              value={settings.aiSpeed}
              onChange={(aiSpeed) => update({ aiSpeed })}
              options={(['slow', 'normal', 'fast'] as const).map((v) => ({ value: v, label: t(`settings.${v}`) }))}
            />
          </StackRow>
        </SettingsGroup>

        <SettingsGroup title={t('settings.feel')}>
          <ToggleRow label={t('settings.sound')} subtitle={t('settings.soundSubtitle')} value={settings.sound} onChange={(sound) => update({ sound })} />
          <ToggleRow label={t('settings.haptics')} value={settings.haptics} onChange={(haptics) => update({ haptics })} />
        </SettingsGroup>

        <SettingsGroup title={t('settings.appearance')}>
          <StackRow label={t('settings.theme')}>
            <Segmented
              label={t('settings.theme')}
              value={settings.themeMode}
              onChange={(themeMode) => update({ themeMode })}
              options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`settings.${v}`) }))}
            />
          </StackRow>
          <ToggleRow label={t('settings.largeDice')} value={settings.largeDice} onChange={(largeDice) => update({ largeDice })} />
          <ToggleRow label={t('settings.highContrast')} value={settings.highContrastPips} onChange={(highContrastPips) => update({ highContrastPips })} />
          <ToggleRow label={t('settings.leftHanded')} subtitle={t('settings.leftHandedSubtitle')} value={settings.leftHanded} onChange={(leftHanded) => update({ leftHanded })} />
          <ToggleRow label={t('settings.reduceMotion')} subtitle={t('settings.reduceMotionSubtitle')} value={settings.reduceMotion} onChange={(reduceMotion) => update({ reduceMotion })} />
        </SettingsGroup>

        <SettingsGroup title={t('settings.reminder')}>
          <ToggleRow label={t('settings.reminder')} subtitle={t('settings.reminderSubtitle')} value={settings.dailyReminder.enabled} onChange={(on) => void setReminder(on)} />
          {settings.dailyReminder.enabled ? (
            <StackRow label={t('settings.reminderTime')}>
              <Segmented
                label={t('settings.reminderTime')}
                value={String(settings.dailyReminder.hour) as (typeof REMINDER_HOURS)[number]}
                onChange={(h) => void setReminder(true, Number(h))}
                options={REMINDER_HOURS.map((h) => ({ value: h, label: hourLabel(Number(h)) }))}
              />
            </StackRow>
          ) : null}
          {reminderDenied ? <Text style={[styles.note, { color: colors.danger }]}>{t('settings.reminderDenied')}</Text> : null}
        </SettingsGroup>

        <SettingsGroup title={t('settings.about')}>
          <LinkRow label={t('settings.fairness')} onPress={() => router.push('/fairness')} />
          <LinkRow label={t('settings.replayTutorial')} onPress={() => router.push('/onboarding')} />
          <LinkRow label={t('settings.privacy')} icon="open-outline" onPress={() => void Linking.openURL(PRIVACY_URL)} />
          <LinkRow label={t('settings.terms')} icon="open-outline" onPress={() => void Linking.openURL(TERMS_URL)} />
        </SettingsGroup>

        <SettingsGroup title={t('settings.data')}>
          <View style={styles.dataBox}>
            <Text style={[styles.note, { color: isReadOnly() ? colors.danger : colors.ink2 }]}>
              {isReadOnly() ? t('settings.dataReadOnly') : t('settings.dataOk')}
            </Text>
          </View>
        </SettingsGroup>

        <Text style={[styles.version, { color: colors.ink3 }]}>
          {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.lg, paddingVertical: space.md },
  note: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, paddingHorizontal: space.lg, paddingBottom: space.md },
  dataBox: { paddingTop: space.md },
  version: { fontFamily: fonts.medium, fontSize: 12.5, textAlign: 'center' },
});
