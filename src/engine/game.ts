import { DICE_COUNT, MAX_ROLLS, type Face } from './dice';
import type { Rng } from './rng';
import { PRESETS, type BoxId, type PresetId } from './rules/presets';
import { allowedBoxes, extraYatzyBonusFor, isCardComplete, scoreFor, totals, type Scorecard } from './scoring';

export type AiLevel = 'easy' | 'normal' | 'expert';
export type GameMode = 'normal' | 'daily';

export interface PlayerConfig {
  id: string;
  name: string;
  kind: 'human' | 'ai';
  aiLevel?: AiLevel;
  color: string;
}

export interface PlayerState extends PlayerConfig {
  card: Scorecard;
  extraYatzyCount: number;
}

export interface GameState {
  id: string;
  mode: GameMode;
  preset: PresetId;
  forcedOrder: boolean;
  players: PlayerState[];
  current: number;
  /** 1-based round number. */
  round: number;
  dice: Face[];
  held: boolean[];
  rollsUsed: number;
  status: 'playing' | 'finished';
  /** State before the last score placement; cleared by the next roll (one level). */
  undo: Omit<GameState, 'undo'> | null;
}

export type GameAction =
  | { type: 'roll'; faces: Face[] }
  | { type: 'toggleHold'; index: number }
  | { type: 'score'; box: BoxId }
  | { type: 'undo' };

export interface NewGameConfig {
  id: string;
  mode?: GameMode;
  preset: PresetId;
  forcedOrder?: boolean;
  players: PlayerConfig[];
}

export function createGame(config: NewGameConfig): GameState {
  if (config.players.length < 1 || config.players.length > 6) throw new Error('A game needs 1 to 6 players');
  return {
    id: config.id,
    mode: config.mode ?? 'normal',
    preset: config.preset,
    forcedOrder: config.forcedOrder ?? false,
    players: config.players.map((p) => ({ ...p, card: {}, extraYatzyCount: 0 })),
    current: 0,
    round: 1,
    dice: [1, 1, 1, 1, 1],
    held: [false, false, false, false, false],
    rollsUsed: 0,
    status: 'playing',
    undo: null,
  };
}

export function currentPlayer(state: GameState): PlayerState {
  return state.players[state.current];
}

export function canRoll(state: GameState): boolean {
  return state.status === 'playing' && state.rollsUsed < MAX_ROLLS;
}

/** Draws one face per die that is not held, in dice order. */
export function rollAction(state: GameState, rng: Rng): GameAction {
  const faces = state.held.filter((h) => !h).map(() => rng.nextFace());
  return { type: 'roll', faces };
}

export function playerTotal(state: GameState, index: number): number {
  const player = state.players[index];
  return totals(PRESETS[state.preset], player.card, player.extraYatzyCount).total;
}

export function scoreOptions(state: GameState): Scorecard {
  if (state.status !== 'playing' || state.rollsUsed === 0) return {};
  const preset = PRESETS[state.preset];
  const player = currentPlayer(state);
  const result: Scorecard = {};
  for (const box of allowedBoxes(preset, player.card, state.dice, state.forcedOrder)) {
    result[box] = scoreFor(preset, player.card, state.dice, box);
  }
  return result;
}

function withoutUndo(state: GameState): Omit<GameState, 'undo'> {
  const { undo: _undo, ...rest } = state;
  return rest;
}

/** Pure reducer. Invalid actions return the same state object. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'roll': {
      if (!canRoll(state)) return state;
      const freeCount = state.held.filter((h) => !h).length;
      if (action.faces.length !== freeCount) return state;
      let next = 0;
      const dice = state.dice.map((d, i) => (state.held[i] ? d : action.faces[next++]));
      return { ...state, dice, rollsUsed: state.rollsUsed + 1, undo: null };
    }
    case 'toggleHold': {
      const { index } = action;
      if (state.status !== 'playing' || state.rollsUsed === 0 || state.rollsUsed >= MAX_ROLLS) return state;
      if (!Number.isInteger(index) || index < 0 || index >= DICE_COUNT) return state;
      const held = state.held.map((h, i) => (i === index ? !h : h));
      return { ...state, held };
    }
    case 'score': {
      if (state.status !== 'playing' || state.rollsUsed === 0) return state;
      const preset = PRESETS[state.preset];
      const player = currentPlayer(state);
      if (!allowedBoxes(preset, player.card, state.dice, state.forcedOrder).includes(action.box)) return state;

      const updated: PlayerState = {
        ...player,
        card: { ...player.card, [action.box]: scoreFor(preset, player.card, state.dice, action.box) },
        extraYatzyCount:
          player.extraYatzyCount + (extraYatzyBonusFor(preset, player.card, state.dice) > 0 ? 1 : 0),
      };
      const players = state.players.map((p, i) => (i === state.current ? updated : p));
      const finished = players.every((p) => isCardComplete(preset, p.card));
      const nextIndex = (state.current + 1) % players.length;
      return {
        ...state,
        players,
        current: finished ? state.current : nextIndex,
        round: !finished && nextIndex === 0 ? state.round + 1 : state.round,
        held: [false, false, false, false, false],
        rollsUsed: 0,
        status: finished ? 'finished' : 'playing',
        undo: withoutUndo(state),
      };
    }
    case 'undo':
      if (!state.undo) return state;
      return { ...state.undo, undo: null };
  }
}
