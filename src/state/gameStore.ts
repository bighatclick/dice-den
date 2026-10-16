import { create } from 'zustand';
import { canRoll, createGame, gameReducer, rollAction, type GameAction, type GameState, type PlayerConfig } from '../engine/game';
import type { BoxId, PresetId } from '../engine/rules/presets';
import { getAppData, updateAppData } from './appData';
import { toLogEntry } from './gameLog';
import { getGameRng } from './rng';

export interface StartOptions {
  preset?: PresetId;
  forcedOrder?: boolean;
  players: PlayerConfig[];
}

interface GameStore {
  game: GameState | null;
  /** Bumps on every roll so the dice know to tumble; not persisted. */
  rollSeq: number;
  hydrate(): void;
  start(options: StartOptions): GameState;
  roll(): void;
  toggleHold(index: number): void;
  score(box: BoxId): void;
  undo(): void;
  /** Leaves the final scorecard: the finished game is no longer "in progress". */
  dismissFinished(): void;
}

function newGameId(): string {
  return `g${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/**
 * The game table's store. Every change is written straight to storage
 * (specs.md F2: autosave after every roll, hold and score).
 */
export const useGameStore = create<GameStore>()((set, get) => {
  function apply(action: GameAction) {
    const game = get().game;
    if (!game) return;
    const next = gameReducer(game, action);
    if (next === game) return;
    const justFinished = game.status === 'playing' && next.status === 'finished';
    updateAppData((data) => {
      const updated = { ...data, inProgress: next };
      if (!justFinished) return updated;
      return {
        ...updated,
        gameLog: [...data.gameLog, toLogEntry(next, new Date().toISOString())],
        stats: { ...data.stats, gamesCompleted: data.stats.gamesCompleted + 1 },
      };
    });
    set((s) => ({ game: next, rollSeq: action.type === 'roll' ? s.rollSeq + 1 : s.rollSeq }));
  }

  return {
    game: null,
    rollSeq: 0,
    hydrate() {
      set({ game: getAppData().inProgress });
    },
    start({ players, preset, forcedOrder }) {
      const settings = getAppData().settings;
      const game = createGame({
        id: newGameId(),
        preset: preset ?? settings.preset,
        forcedOrder: forcedOrder ?? settings.forcedOrder,
        players,
      });
      updateAppData((data) => ({ ...data, inProgress: game }));
      set({ game });
      return game;
    },
    roll() {
      const game = get().game;
      if (!game || !canRoll(game)) return;
      apply(rollAction(game, getGameRng()));
    },
    toggleHold(index) {
      apply({ type: 'toggleHold', index });
    },
    score(box) {
      apply({ type: 'score', box });
    },
    undo() {
      const game = get().game;
      // Undoing the final placement would reopen a game that is already in the log.
      if (!game || game.status === 'finished') return;
      apply({ type: 'undo' });
    },
    dismissFinished() {
      if (get().game?.status !== 'finished') return;
      updateAppData((data) => ({ ...data, inProgress: null }));
      set({ game: null });
    },
  };
});
