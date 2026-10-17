import { activeTrials } from '../ads/policy';
import type { RootData } from '../data/schema';
import { entitlementsFor } from '../iap/products';
import { DEFAULT_SKIN, DEFAULT_TABLE, DICE_SKINS, TABLES, skinById, tableById, type DiceSkin, type TableStyle } from '../ui/cosmetics';
import { getAppData } from './appData';
import { useSettings } from './settingsStore';
import { useShopStore } from './shopStore';

export type CosmeticKind = 'dice' | 'table';

/** Trials are stored per kind: "walnut" is both a skin and a table. */
export function trialKey(kind: CosmeticKind, id: string): string {
  return `${kind}:${id}`;
}

export interface OwnedCosmetics {
  dice: Set<string>;
  tables: Set<string>;
  /** Trial keys (see trialKey) of items owned only through a running 24 h trial. */
  trials: Set<string>;
}

/** Start items, earned unlocks, purchases and running rewarded trials. */
export function ownedCosmetics(data: RootData, owned: readonly string[], now: Date): OwnedCosmetics {
  const bought = entitlementsFor(owned);
  const dice = new Set([...DICE_SKINS.filter((s) => s.source === 'start').map((s) => s.id), ...data.unlocks.dice, ...bought.dice]);
  const tables = new Set([...TABLES.filter((t) => t.source === 'start').map((t) => t.id), ...data.unlocks.tables, ...bought.tables]);
  const trials = new Set<string>();
  for (const key of activeTrials(data.ads, now)) {
    const [kind, id] = key.split(':');
    if (kind === 'dice' && skinById(id) && !dice.has(id)) {
      dice.add(id);
      trials.add(key);
    } else if (kind === 'table' && tableById(id) && !tables.has(id)) {
      tables.add(id);
      trials.add(key);
    }
  }
  return { dice, tables, trials };
}

/** The equipped skin and table, falling back to the defaults once a trial ends. */
export function useEquipped(): { skin: DiceSkin; table: TableStyle } {
  const { diceSkin, table } = useSettings();
  const owned = useShopStore((s) => s.owned);
  const mine = ownedCosmetics(getAppData(), owned, new Date());
  return {
    skin: (mine.dice.has(diceSkin) && skinById(diceSkin)) || DEFAULT_SKIN,
    table: (mine.tables.has(table) && tableById(table)) || DEFAULT_TABLE,
  };
}
