import type { AiLevel } from '../engine/game';
import type { PresetId } from '../engine/rules/presets';
import type { GameLogEntry } from '../data/schema';

export type StatsFilter = 'all' | PresetId;

export interface WinRecord {
  played: number;
  won: number;
}

export interface Stats {
  games: number;
  highScore: number | null;
  average: number | null;
  yatzys: number;
  /** Share of "your" games (one person at the table) where the upper bonus was made. */
  bonusRate: number | null;
  vs: Record<AiLevel, WinRecord>;
  passAndPlay: number;
  daily: number;
  humanFaces: number[];
  aiFaces: number[];
}

const zero = () => [0, 0, 0, 0, 0, 0];

/** Everything on the Stats screen, computed locally from the game log (specs.md F7). */
export function computeStats(log: readonly GameLogEntry[], filter: StatsFilter = 'all'): Stats {
  const games = log.filter((g) => filter === 'all' || g.preset === filter);
  const stats: Stats = {
    games: games.length,
    highScore: null,
    average: null,
    yatzys: 0,
    bonusRate: null,
    vs: { easy: { played: 0, won: 0 }, normal: { played: 0, won: 0 }, expert: { played: 0, won: 0 } },
    passAndPlay: 0,
    daily: 0,
    humanFaces: zero(),
    aiFaces: zero(),
  };
  let ownTotal = 0;
  let ownGames = 0;
  let bonusGames = 0;

  for (const g of games) {
    const humans = g.players.flatMap((p, i) => (p.kind === 'human' ? [i] : []));
    for (const i of humans) stats.highScore = Math.max(stats.highScore ?? 0, g.players[i].total);
    stats.yatzys += g.yatzys ?? g.extraYatzys;
    for (let f = 0; f < 6; f++) {
      stats.humanFaces[f] += g.humanFaceCounts[f] ?? 0;
      stats.aiFaces[f] += g.aiFaceCounts[f] ?? 0;
    }
    if (g.mode === 'daily') stats.daily += 1;
    if (humans.length >= 2) stats.passAndPlay += 1;
    if (humans.length !== 1) continue;

    const me = humans[0];
    ownGames += 1;
    ownTotal += g.players[me].total;
    if (g.upperBonusMade) bonusGames += 1;
    const ai = g.players.filter((p) => p.kind === 'ai');
    if (ai.length === 1 && ai[0].aiLevel) {
      const record = stats.vs[ai[0].aiLevel];
      record.played += 1;
      if (g.winnerIndexes.length === 1 && g.winnerIndexes[0] === me) record.won += 1;
    }
  }
  if (ownGames > 0) {
    stats.average = Math.round(ownTotal / ownGames);
    stats.bonusRate = bonusGames / ownGames;
  }
  return stats;
}

/** Percent of rolls per face, for the fairness chart (each should hover near 16.7%). */
export function facePercents(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map((c) => (total === 0 ? 0 : (c / total) * 100));
}
