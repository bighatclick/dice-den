import { create } from 'zustand';
import { nextAiStep } from '../ai';
import { canRoll, createGame, emptyTally, gameReducer, playerTotal, rollAction, type GameAction, type GameState, type PlayerConfig } from '../engine/game';
import { createDailyRng, type Rng } from '../engine/rng';
import type { BoxId, PresetId } from '../engine/rules/presets';
import { getAppData, updateAppData } from './appData';
import { completeDaily, dailyDateOf, dailyGameId } from './daily';
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
  /** Today's seeded game (specs.md S7). `replay` > 0 replays a date already completed. */
  startDaily(dateKey: string, you: PlayerConfig, replay?: number): GameState;
  roll(): void;
  toggleHold(index: number): void;
  score(box: BoxId): void;
  undo(): void;
  /** Plays the next step of a computer turn; false when it is not a computer's turn. */
  aiStep(): boolean;
  /** Plays the rest of the current computer turn at once ("tap to skip"). */
  skipAiTurn(): void;
  /** Leaves the final scorecard: the finished game is no longer "in progress". */
  dismissFinished(): void;
}

/** Only a person can take back their own last score; a computer's placement stands. */
export function canUndo(game: GameState): boolean {
  return game.undo !== null && game.undo.players[game.undo.current].kind === 'human';
}

let dailyRng: { gameId: string; drawn: number; rng: Rng } | null = null;

/**
 * Normal games use the shared crypto RNG. A daily game replays the date's sfc32
 * sequence; after a relaunch it fast-forwards past the faces already rolled.
 */
function rngFor(game: GameState): Rng {
  const date = game.mode === 'daily' ? dailyDateOf(game.id) : null;
  if (!date) return getGameRng();
  const tally = game.faceTally ?? emptyTally();
  const drawn = [...tally.human, ...tally.ai].reduce((a, b) => a + b, 0);
  if (!dailyRng || dailyRng.gameId !== game.id || dailyRng.drawn !== drawn) {
    const rng = createDailyRng(date);
    for (let i = 0; i < drawn; i++) rng.nextFace();
    dailyRng = { gameId: game.id, drawn, rng };
  }
  const cache = dailyRng;
  return {
    nextFace() {
      cache.drawn += 1;
      return cache.rng.nextFace();
    },
  };
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
      const date = next.mode === 'daily' ? dailyDateOf(next.id) : null;
      return {
        ...updated,
        gameLog: [...data.gameLog, toLogEntry(next, new Date().toISOString())],
        stats: { ...data.stats, gamesCompleted: data.stats.gamesCompleted + 1 },
        daily: date ? completeDaily(data.daily, date, playerTotal(next, 0)) : data.daily,
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
    startDaily(dateKey, you, replay = 0) {
      const game = createGame({ id: dailyGameId(dateKey, replay), mode: 'daily', preset: 'classic', players: [you] });
      updateAppData((data) => ({ ...data, inProgress: game }));
      set({ game });
      return game;
    },
    roll() {
      const game = get().game;
      if (!game || !canRoll(game)) return;
      apply(rollAction(game, rngFor(game)));
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
      if (!game || game.status === 'finished' || !canUndo(game)) return;
      apply({ type: 'undo' });
    },
    aiStep() {
      const game = get().game;
      const step = game && nextAiStep(game);
      if (!step) return false;
      if (step.type === 'roll') get().roll();
      else apply(step);
      return true;
    },
    skipAiTurn() {
      const start = get().game;
      if (!start) return;
      // Bounded: a turn is at most 3 rolls, 5 holds per roll and a score.
      for (let i = 0; i < 30; i++) {
        const game = get().game;
        if (!game || game.current !== start.current || game.round !== start.round || !get().aiStep()) return;
      }
    },
    dismissFinished() {
      if (get().game?.status !== 'finished') return;
      updateAppData((data) => ({ ...data, inProgress: null }));
      set({ game: null });
    },
  };
});
