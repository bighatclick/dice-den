import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { prepareRewarded, rewardedAvailableToday, watchRewarded } from '../src/ads';
import { grantTrial } from '../src/ads/policy';
import { MONETIZATION_ENABLED } from '../src/config/features';
import { PRODUCT_IDS, entitlementsFor, packFor, type ProductId, type ProductKey } from '../src/iap/products';
import { getAppData, updateAppData } from '../src/state/appData';
import { ownedCosmetics, trialKey, useEquipped, type CosmeticKind } from '../src/state/cosmetics';
import { useSettingsStore } from '../src/state/settingsStore';
import { useShopStore } from '../src/state/shopStore';
import { GAMES_FOR_UNLOCK, STREAK_FOR_UNLOCK } from '../src/state/unlocks';
import { Button } from '../src/ui/Button';
import { DICE_SKINS, TABLES, type CosmeticSource } from '../src/ui/cosmetics';
import { DieFace } from '../src/ui/Die';
import { Felt } from '../src/ui/Felt';
import { Screen } from '../src/ui/Screen';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { fonts, radius, space, touchTarget } from '../src/ui/tokens';
import { useTheme } from '../src/ui/theme';

const PRIVACY_URL = 'https://dicedengame.vercel.app/privacy';
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/**
 * S9 Shop: Remove Ads, packs, the Supporter Bundle, the dice and table picker,
 * rewarded 24 h trials and Restore Purchases. Prices only ever come from the
 * store (CLAUDE.md rule 8); with no store the picker still works.
 * With ads and purchases switched off (src/config/features.ts) it is only the
 * dice and table picker: free and earned styles, nothing to buy or try.
 */
export default function ShopScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { owned, prices, status, busy, message } = useShopStore();
  const { skin, table } = useEquipped();
  // Bumped after a trial starts so ownership (read from storage) is re-read.
  const [, setTrialSeq] = useState(0);
  // The tile whose ad could not be shown: the note goes right under its button, where the player is looking.
  const [trialNote, setTrialNote] = useState<string | null>(null);
  const [trialPending, setTrialPending] = useState<string | null>(null);

  useEffect(() => {
    if (MONETIZATION_ENABLED) {
      void useShopStore.getState().load();
      void prepareRewarded();
    }
    return () => useShopStore.getState().clearMessage();
  }, []);

  const bought = entitlementsFor(owned);
  const mine = ownedCosmetics(getAppData(), owned, new Date());
  const trialsLeft = rewardedAvailableToday();
  const ownsProduct = (key: ProductKey) =>
    ({
      removeAds: bought.removeAds,
      supporter: owned.includes(PRODUCT_IDS.supporter),
      classicPack: bought.dice.includes('bone'),
      tablePack: bought.tables.includes('slate'),
      complete: bought.dice.includes('bone') && bought.tables.includes('slate'),
    })[key];

  function equip(kind: CosmeticKind, id: string) {
    useSettingsStore.getState().update(kind === 'dice' ? { diceSkin: id } : { table: id });
  }

  async function tryFor24h(kind: CosmeticKind, id: string) {
    const key = trialKey(kind, id);
    setTrialNote(null);
    setTrialPending(key);
    const result = await watchRewarded();
    setTrialPending(null);
    if (result === 'earned') {
      updateAppData((d) => ({ ...d, ads: grantTrial(d.ads, trialKey(kind, id), new Date()) }));
      equip(kind, id);
      setTrialSeq((n) => n + 1);
    } else if (result === 'unavailable') {
      setTrialNote(key);
    }
  }

  const products: { key: ProductKey; title: string; body: string }[] = [
    { key: 'removeAds', title: t('shop.removeAds'), body: t('shop.removeAdsBody') },
    { key: 'supporter', title: t('shop.supporter'), body: t('shop.supporterBody') },
    { key: 'classicPack', title: t('shop.classicPack'), body: t('shop.classicPackBody') },
    { key: 'tablePack', title: t('shop.tablePack'), body: t('shop.tablePackBody') },
    { key: 'complete', title: t('shop.complete'), body: t('shop.completeBody') },
  ];

  // With purchases off, styles that only come in a pack are hidden (unless already owned).
  function forSale(source: CosmeticSource, has: boolean): boolean {
    return MONETIZATION_ENABLED || has || packFor(source) === null;
  }

  function lockedHint(source: CosmeticSource): string {
    if (source === 'games10') return t('shop.earnGames', { count: GAMES_FOR_UNLOCK });
    if (source === 'streak7') return t('shop.earnStreak', { count: STREAK_FOR_UNLOCK });
    return t('shop.inPack', { pack: t(source === 'classicPack' ? 'shop.classicPack' : 'shop.tablePack') });
  }

  function tile(kind: CosmeticKind, id: string, source: CosmeticSource, name: string, preview: ReactNode) {
    const has = kind === 'dice' ? mine.dice.has(id) : mine.tables.has(id);
    const inUse = (kind === 'dice' ? skin.id : table.id) === id;
    const onTrial = mine.trials.has(trialKey(kind, id));
    const canTry = !has && packFor(source) !== null && trialsLeft > 0;
    let state: string;
    if (inUse) state = onTrial ? `${t('shop.equipped')} · ${t('shop.trialActive')}` : t('shop.equipped');
    else if (has) state = onTrial ? t('shop.trialActive') : t('shop.use');
    else state = lockedHint(source);
    return (
      <View key={`${kind}-${id}`} style={styles.tileWrap}>
        <Pressable
          testID={`cosmetic-${kind}-${id}`}
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${state}`}
          accessibilityState={{ selected: inUse, disabled: !has }}
          disabled={!has}
          onPress={() => equip(kind, id)}
          style={[
            styles.tile,
            { backgroundColor: colors.surface, borderColor: inUse ? colors.accent : colors.line },
            inUse && styles.tileSelected,
          ]}
        >
          <View style={[styles.preview, !has && styles.locked]}>{preview}</View>
          <View style={styles.tileText}>
            <Text style={[styles.tileName, { color: colors.ink }]}>{name}</Text>
            <View style={styles.tileStateRow}>
              {!has ? <Ionicons name={source === 'games10' || source === 'streak7' ? 'trophy-outline' : 'lock-closed'} size={11} color={colors.ink3} /> : null}
              {inUse ? <Ionicons name="checkmark-circle" size={12} color={colors.accent} /> : null}
              <Text style={[styles.tileState, { color: inUse ? colors.accent : colors.ink2 }]}>{state}</Text>
            </View>
          </View>
        </Pressable>
        {canTry ? (
          <Pressable
            testID={`trial-${kind}-${id}`}
            accessibilityRole="button"
            accessibilityLabel={t('shop.trialA11y', { name })}
            accessibilityState={{ busy: trialPending === trialKey(kind, id), disabled: trialPending !== null }}
            disabled={trialPending !== null}
            onPress={() => void tryFor24h(kind, id)}
            style={({ pressed }) => [styles.trial, { borderColor: colors.line }, (pressed || trialPending === trialKey(kind, id)) && { opacity: 0.6 }]}
          >
            <Ionicons name="play-circle-outline" size={15} color={colors.primary} />
            <Text style={[styles.trialText, { color: colors.primary }]}>{t('shop.trial')}</Text>
          </Pressable>
        ) : null}
        {trialNote === trialKey(kind, id) ? (
          <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.trialNote, { color: colors.ink2 }]}>
            {t('shop.trialUnavailable')}
          </Text>
        ) : null}
      </View>
    );
  }

  const notice = message ? t(`shop.${message}`) : null;

  return (
    <Screen>
      <ScreenHeader title={MONETIZATION_ENABLED ? t('shop.title') : t('settings.diceAndTables')} />
      <ScrollView contentContainerStyle={styles.content}>
        {MONETIZATION_ENABLED ? <Text style={[styles.intro, { color: colors.ink2 }]}>{t('shop.intro')}</Text> : null}
        {notice ? (
          <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: colors.accentSoft }]}>
            <Text testID="shop-notice" style={[styles.noticeText, { color: colors.ink }]}>
              {notice}
            </Text>
          </View>
        ) : null}
        {status === 'unavailable' ? (
          <Text style={[styles.note, { color: colors.ink2 }]}>{t('shop.storeUnavailable')}</Text>
        ) : status === 'loading' ? (
          <Text style={[styles.note, { color: colors.ink3 }]}>{t('shop.loading')}</Text>
        ) : null}

        {products
          .filter(({ key }) => MONETIZATION_ENABLED && (key !== 'complete' || !ownsProduct('complete')))
          .map(({ key, title, body }) => {
            const id: ProductId = PRODUCT_IDS[key];
            const price = prices[id];
            const has = ownsProduct(key);
            return (
              <View key={key} style={[styles.product, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <View style={styles.productHead}>
                  <Text accessibilityRole="header" style={[styles.productTitle, { color: colors.ink }]}>
                    {title}
                  </Text>
                  {has ? (
                    <View style={styles.ownedRow}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                      <Text style={[styles.owned, { color: colors.accent }]}>{t('shop.owned')}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.productBody, { color: colors.ink2 }]}>{body}</Text>
                {has ? null : (
                  <>
                    <Text style={[styles.oneTime, { color: colors.ink3 }]}>{t('shop.oneTime')}</Text>
                    <View testID={`buy-${key}`}>
                      <Button
                        variant={key === 'removeAds' ? 'primary' : 'secondary'}
                        label={price ? t('shop.buy', { price }) : t('shop.priceUnavailable')}
                        accessibilityLabel={price ? t('shop.buyA11y', { name: title, price }) : `${title}, ${t('shop.priceUnavailable')}`}
                        disabled={!price || busy !== null}
                        onPress={() => void useShopStore.getState().buy(id)}
                      />
                    </View>
                  </>
                )}
              </View>
            );
          })}

        <Text accessibilityRole="header" style={[styles.section, { color: colors.ink3 }]}>
          {t('shop.dice').toUpperCase()}
        </Text>
        {MONETIZATION_ENABLED ? (
          <Text style={[styles.note, { color: colors.ink3 }]}>
            {trialsLeft > 0 ? t('shop.trialsLeft', { count: trialsLeft }) : t('shop.noTrials')}
          </Text>
        ) : null}
        <View style={styles.grid}>
          {DICE_SKINS.filter((s) => forSale(s.source, mine.dice.has(s.id))).map((s) =>
            tile('dice', s.id, s.source, t(`shop.skins.${s.id}`), <DieFace value={5} size={40} skin={s} />),
          )}
        </View>

        <Text accessibilityRole="header" style={[styles.section, { color: colors.ink3 }]}>
          {t('shop.tables').toUpperCase()}
        </Text>
        <View style={styles.grid}>
          {TABLES.filter((tb) => forSale(tb.source, mine.tables.has(tb.id))).map((tb) =>
            tile(
              'table',
              tb.id,
              tb.source,
              t(`shop.tableNames.${tb.id}`),
              <View style={styles.tablePreview}>
                <Felt table={tb} />
              </View>,
            ),
          )}
        </View>

        {MONETIZATION_ENABLED ? (
          <View testID="restore-button" style={styles.restore}>
            <Button
              label={busy === 'restore' ? t('shop.restoring') : t('shop.restore')}
              disabled={busy !== null}
              onPress={() => void useShopStore.getState().restore()}
            />
          </View>
        ) : null}
        <View style={styles.links}>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(TERMS_URL)} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.ink2 }]}>{t('shop.terms')}</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(PRIVACY_URL)} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.ink2 }]}>{t('shop.privacy')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingVertical: space.md },
  intro: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21 },
  notice: { borderRadius: radius.md, padding: space.md },
  noticeText: { fontFamily: fonts.semibold, fontSize: 14.5 },
  note: { fontFamily: fonts.body, fontSize: 13.5 },
  product: { borderWidth: 1, borderRadius: radius.xl, padding: space.lg, gap: space.sm },
  productHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  productTitle: { fontFamily: fonts.displaySemi, fontSize: 19, flexShrink: 1 },
  ownedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  owned: { fontFamily: fonts.bold, fontSize: 13 },
  productBody: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21 },
  oneTime: { fontFamily: fonts.semibold, fontSize: 12.5 },
  section: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 1.3, marginTop: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tileWrap: { flexBasis: '48%', flexGrow: 1, gap: 4 },
  tile: {
    minHeight: touchTarget + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  tileSelected: { borderWidth: 2.5 },
  preview: { width: 52, height: 40, alignItems: 'center', justifyContent: 'center' },
  locked: { opacity: 0.55 },
  tablePreview: { width: 52, height: 38, borderRadius: 8, overflow: 'hidden' },
  tileText: { flex: 1 },
  tileName: { fontFamily: fonts.bold, fontSize: 14 },
  tileStateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  tileState: { fontFamily: fonts.medium, fontSize: 12, flexShrink: 1 },
  trial: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  trialText: { fontFamily: fonts.bold, fontSize: 13 },
  trialNote: { fontFamily: fonts.medium, fontSize: 12.5, textAlign: 'center' },
  restore: { marginTop: space.md },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
  link: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: space.sm },
  linkText: { fontFamily: fonts.medium, fontSize: 13.5, textDecorationLine: 'underline' },
});
