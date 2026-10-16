import type { Face } from '../dice';
import {
  canRoll,
  createGame,
  currentPlayer,
  gameReducer,
  playerTotal,
  rollAction,
  scoreOptions,
  type GameAction,
  type GameState,
  type PlayerConfig,
} from '../game';
import { createSeededRng } from '../rng';
import { CLASSIC } from '../rules/presets';

const you: PlayerConfig = { id: 'p1', name: 'You', kind: 'human', color: '#8A4520' };
const cpu: PlayerConfig = { id: 'p2', name: 'Computer (Normal)', kind: 'ai', aiLevel: 'normal', color: '#3D525E' };

const roll = (...faces: Face[]): GameAction => ({ type: 'roll', faces });
const apply = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);

describe('face tally (fairness chart)', () => {
  it('counts only newly rolled faces, split by human and AI', () => {
    let s = createGame({ id: 'g', preset: 'classic', players: [you, cpu] });
    s = apply(s, roll(1, 2, 3, 4, 6), { type: 'toggleHold', index: 4 }, roll(6, 6, 6, 6), { type: 'score', box: 'sixes' });
    s = apply(s, roll(5, 5, 5, 5, 5));
    expect(s.faceTally).toEqual({ human: [1, 1, 1, 1, 0, 5], ai: [0, 0, 0, 0, 5, 0] });
  });

  it('starts from zero for games saved before the tally existed', () => {
    const { faceTally: _t, ...old } = createGame({ id: 'g', preset: 'classic', players: [you] });
    expect(gameReducer(old, roll(3, 3, 3, 3, 3)).faceTally?.human).toEqual([0, 0, 5, 0, 0, 0]);
  });
});

describe('createGame', () => {
  it('starts with empty cards and no rolls', () => {
    const g = createGame({ id: 'g', preset: 'classic', players: [you, cpu] });
    expect(g).toMatchObject({ mode: 'normal', forcedOrder: false, current: 0, round: 1, rollsUsed: 0, status: 'playing' });
    expect(g.players.map((p) => p.card)).toEqual([{}, {}]);
  });

  it('needs 1 to 6 players', () => {
    expect(() => createGame({ id: 'g', preset: 'classic', players: [] })).toThrow();
    expect(() => createGame({ id: 'g', preset: 'classic', players: Array(7).fill(you) })).toThrow();
  });
});

describe('rolling and holding', () => {
  const g = createGame({ id: 'g', preset: 'classic', players: [you] });

  it('rolls all dice first, then only the free ones', () => {
    let s = apply(g, roll(1, 2, 3, 4, 5));
    expect(s.dice).toEqual([1, 2, 3, 4, 5]);
    s = apply(s, { type: 'toggleHold', index: 0 }, { type: 'toggleHold', index: 4 }, roll(6, 6, 6));
    expect(s.dice).toEqual([1, 6, 6, 6, 5]);
    expect(s.rollsUsed).toBe(2);
  });

  it('ignores a roll with the wrong number of faces', () => {
    expect(gameReducer(g, roll(1, 2))).toBe(g);
  });

  it('allows at most three rolls', () => {
    const s = apply(g, roll(1, 1, 1, 1, 1), roll(2, 2, 2, 2, 2), roll(3, 3, 3, 3, 3));
    expect(canRoll(s)).toBe(false);
    expect(gameReducer(s, roll(4, 4, 4, 4, 4))).toBe(s);
  });

  it('only holds between rolls and only valid dice', () => {
    expect(gameReducer(g, { type: 'toggleHold', index: 0 })).toBe(g);
    const s = apply(g, roll(1, 2, 3, 4, 5));
    expect(gameReducer(s, { type: 'toggleHold', index: 5 })).toBe(s);
    expect(gameReducer(s, { type: 'toggleHold', index: 1.5 })).toBe(s);
    const held = apply(s, { type: 'toggleHold', index: 2 });
    expect(held.held).toEqual([false, false, true, false, false]);
    expect(apply(held, { type: 'toggleHold', index: 2 }).held).toEqual([false, false, false, false, false]);
    const third = apply(s, roll(1, 1, 1, 1, 1), roll(1, 1, 1, 1, 1));
    expect(gameReducer(third, { type: 'toggleHold', index: 0 })).toBe(third);
  });

  it('draws one face per free die from the shared RNG', () => {
    const s = apply(g, roll(1, 2, 3, 4, 5), { type: 'toggleHold', index: 1 });
    const action = rollAction(s, createSeededRng('t'));
    expect(action.type === 'roll' && action.faces).toHaveLength(4);
  });
});

describe('scoring and turns', () => {
  const g = createGame({ id: 'g', preset: 'classic', players: [you, cpu] });

  it('cannot score before the first roll or in a disallowed box', () => {
    expect(gameReducer(g, { type: 'score', box: 'chance' })).toBe(g);
    const s = apply(g, roll(1, 2, 3, 4, 5));
    expect(gameReducer(s, { type: 'score', box: 'onePair' })).toBe(s);
    expect(scoreOptions(g)).toEqual({});
  });

  it('scores, passes to the next player and resets the dice state', () => {
    const s = apply(g, roll(1, 2, 3, 4, 5), { type: 'toggleHold', index: 0 }, { type: 'score', box: 'largeStraight' });
    expect(s.players[0].card).toEqual({ largeStraight: 40 });
    expect(s.current).toBe(1);
    expect(s.round).toBe(1);
    expect(s.held).toEqual([false, false, false, false, false]);
    expect(s.rollsUsed).toBe(0);
    const back = apply(s, roll(2, 2, 2, 3, 3), { type: 'score', box: 'fullHouse' });
    expect(back.current).toBe(0);
    expect(back.round).toBe(2);
    expect(playerTotal(back, 1)).toBe(25);
  });

  it('counts extra Yatzys under the joker rule', () => {
    const solo = createGame({ id: 'g', preset: 'classic', players: [you] });
    const s = apply(solo, roll(4, 4, 4, 4, 4), { type: 'score', box: 'yatzy' }, roll(4, 4, 4, 4, 4));
    expect(Object.keys(scoreOptions(s))).toEqual(['fours']);
    const scored = apply(s, { type: 'score', box: 'fours' });
    expect(currentPlayer(scored).extraYatzyCount).toBe(1);
    expect(playerTotal(scored, 0)).toBe(50 + 20 + 100);
  });

  it('undoes the last placement until the next roll, one level deep', () => {
    const rolled = apply(g, roll(6, 6, 6, 1, 2));
    const scored = apply(rolled, { type: 'score', box: 'sixes' });
    const undone = apply(scored, { type: 'undo' });
    expect(undone).toEqual({ ...rolled, undo: null });
    expect(gameReducer(undone, { type: 'undo' })).toBe(undone);
    const afterRoll = apply(scored, roll(1, 1, 1, 1, 1));
    expect(afterRoll.undo).toBeNull();
  });

  it('finishes when every card is full', () => {
    let s = createGame({ id: 'g', preset: 'classic', players: [you], forcedOrder: true });
    for (let i = 0; i < CLASSIC.boxes.length; i++) {
      s = apply(s, roll(1, 2, 3, 4, 5), { type: 'score', box: CLASSIC.boxes[i] });
    }
    expect(s.status).toBe('finished');
    expect(s.round).toBe(13);
    expect(canRoll(s)).toBe(false);
    expect(gameReducer(s, { type: 'toggleHold', index: 0 })).toBe(s);
    expect(scoreOptions(s)).toEqual({});
    expect(apply(s, { type: 'undo' }).status).toBe('playing');
  });
});
