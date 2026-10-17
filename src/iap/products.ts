import { DICE_SKINS, TABLES, type CosmeticSource } from '../ui/cosmetics';

/**
 * The five non-consumable products (specs.md §7.2). No currency, no
 * subscriptions, nothing that changes the dice (CLAUDE.md rule 6). Prices
 * always come from the store, never from here (rule 8).
 */
export const PRODUCT_IDS = {
  removeAds: 'com.dicedengame.app.removeads',
  classicPack: 'com.dicedengame.app.pack.classic',
  tablePack: 'com.dicedengame.app.pack.tables',
  complete: 'com.dicedengame.app.complete',
  supporter: 'com.dicedengame.app.supporter',
} as const;

export type ProductKey = keyof typeof PRODUCT_IDS;
export type ProductId = (typeof PRODUCT_IDS)[ProductKey];

export const ALL_PRODUCT_IDS: readonly ProductId[] = Object.values(PRODUCT_IDS);

export function isProductId(id: string): id is ProductId {
  return (ALL_PRODUCT_IDS as readonly string[]).includes(id);
}

const PACK_SOURCES: Record<ProductId, { removeAds: boolean; sources: CosmeticSource[] }> = {
  [PRODUCT_IDS.removeAds]: { removeAds: true, sources: [] },
  [PRODUCT_IDS.classicPack]: { removeAds: false, sources: ['classicPack'] },
  [PRODUCT_IDS.tablePack]: { removeAds: false, sources: ['tablePack'] },
  [PRODUCT_IDS.complete]: { removeAds: false, sources: ['classicPack', 'tablePack'] },
  // Supporter: Remove Ads plus every current and future pack.
  [PRODUCT_IDS.supporter]: { removeAds: true, sources: ['classicPack', 'tablePack'] },
};

export interface Entitlements {
  removeAds: boolean;
  dice: string[];
  tables: string[];
}

/** What owning these product ids unlocks. Unknown ids are ignored. */
export function entitlementsFor(owned: readonly string[]): Entitlements {
  const sources = new Set<CosmeticSource>();
  let removeAds = false;
  for (const id of owned) {
    if (!isProductId(id)) continue;
    const grant = PACK_SOURCES[id];
    removeAds ||= grant.removeAds;
    grant.sources.forEach((s) => sources.add(s));
  }
  return {
    removeAds,
    dice: DICE_SKINS.filter((s) => sources.has(s.source)).map((s) => s.id),
    tables: TABLES.filter((t) => sources.has(t.source)).map((t) => t.id),
  };
}

/** The product that sells a cosmetic on its own, if any. */
export function packFor(source: CosmeticSource): ProductId | null {
  if (source === 'classicPack') return PRODUCT_IDS.classicPack;
  if (source === 'tablePack') return PRODUCT_IDS.tablePack;
  return null;
}
