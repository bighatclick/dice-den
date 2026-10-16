import { emptyTally, playerTotal, type GameState } from '../engine/game';
import { PRESETS } from '../engine/rules/presets';
import { totals } from '../engine/scoring';
import type { GameLogEntry } from '../data/schema';

export function winnerIndexes(game: GameState): number[] {
  const scores = game.players.map((_, i) => playerTotal(game, i));
  const best = Math.max(...scores);
  return scores.flatMap((s, i) => (s === best ? [i] : []));
}

export function toLogEntry(game: GameState, finishedAt: string): GameLogEntry {
  const preset = PRESETS[game.preset];
  const tally = game.faceTally ?? emptyTally();
  const humans = game.players.filter((p) => p.kind === 'human');
  return {
    id: game.id,
    finishedAt,
    mode: game.mode,
    preset: game.preset,
    players: game.players.map((p, i) => ({
      name: p.name,
      kind: p.kind,
      ...(p.aiLevel ? { aiLevel: p.aiLevel } : {}),
      total: playerTotal(game, i),
    })),
    winnerIndexes: winnerIndexes(game),
    humanFaceCounts: tally.human,
    aiFaceCounts: tally.ai,
    extraYatzys: humans.reduce((n, p) => n + p.extraYatzyCount, 0),
    yatzys: humans.reduce((n, p) => n + (p.card.yatzy === 50 ? 1 : 0) + p.extraYatzyCount, 0),
    upperBonusMade: humans.some((p) => totals(preset, p.card, p.extraYatzyCount).upperBonus > 0),
  };
}

/** Best human total in earlier games with the same preset, or null if there are none. */
export function previousBest(log: readonly GameLogEntry[], game: GameState): number | null {
  let best: number | null = null;
  for (const entry of log) {
    if (entry.id === game.id || entry.preset !== game.preset) continue;
    for (const p of entry.players) if (p.kind === 'human' && (best === null || p.total > best)) best = p.total;
  }
  return best;
}
