import type { AiLevel, PlayerConfig } from '../engine/game';
import type { GameLogEntry } from '../data/schema';

/** Seat colours, in order; a player keeps the colour of their seat. */
export const SEAT_COLORS = ['#C77D4E', '#5E9BC6', '#8E7CC3', '#5FA785', '#D4A23A', '#C25B7A'] as const;
export const COMPUTER_COLOR = '#55707E';

export type Opponents = 'solo' | 'computer' | 'pass';

export interface SeatDraft {
  kind: 'human' | 'ai';
  name: string;
  aiLevel: AiLevel;
}

export interface TableDraft {
  opponents: Opponents;
  aiLevel: AiLevel;
  seats: SeatDraft[];
}

/**
 * The last table, rebuilt from the game log so names are remembered without a
 * new field in saved data (specs.md S2 "remembers last choice").
 */
export function lastTable(log: readonly GameLogEntry[]): TableDraft {
  const last = [...log].reverse().find((e) => e.mode === 'normal');
  const fallback: TableDraft = { opponents: 'solo', aiLevel: 'normal', seats: [] };
  if (!last) return fallback;
  const humans = last.players.filter((p) => p.kind === 'human');
  const ai = last.players.find((p) => p.kind === 'ai');
  const aiLevel = ai?.aiLevel ?? 'normal';
  const seats = last.players.map((p) => ({ kind: p.kind, name: p.kind === 'human' ? p.name : '', aiLevel: p.aiLevel ?? 'normal' }));
  if (humans.length >= 2) return { opponents: 'pass', aiLevel, seats };
  if (humans.length === 1 && last.players.length === 2 && ai) return { opponents: 'computer', aiLevel, seats };
  if (last.players.length === 1) return { ...fallback, aiLevel };
  return { opponents: 'pass', aiLevel, seats };
}

/** Turns the sheet's choices into players. `names` supplies translated default names. */
export function buildPlayers(
  draft: TableDraft,
  names: { you: string; computer: (level: AiLevel) => string; seat: (n: number) => string },
): PlayerConfig[] {
  const you: PlayerConfig = { id: 'p1', name: names.you, kind: 'human', color: SEAT_COLORS[0] };
  if (draft.opponents === 'solo') return [you];
  if (draft.opponents === 'computer') {
    return [you, { id: 'p2', name: names.computer(draft.aiLevel), kind: 'ai', aiLevel: draft.aiLevel, color: COMPUTER_COLOR }];
  }
  return draft.seats.slice(0, 6).map((seat, i) =>
    seat.kind === 'ai'
      ? { id: `p${i + 1}`, name: names.computer(seat.aiLevel), kind: 'ai', aiLevel: seat.aiLevel, color: SEAT_COLORS[i] }
      : { id: `p${i + 1}`, name: seat.name.trim() || names.seat(i + 1), kind: 'human', color: SEAT_COLORS[i] },
  );
}
