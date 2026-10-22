import { DICE_COUNT, MAX_ROLLS, type Face } from '../dice';
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
import { createSeededRng, type Rng } from '../rng';
import { CLASSIC, PRESETS, SCANDINAVIAN, type BoxId } from '../rules/presets';
import { isCardComplete, openBoxes, potentialScores, totals } from '../scoring';

const human = (id: string, name = id): PlayerConfig => ({ id, name, kind: 'human', color: '#000' });
const ai = (id: string): PlayerConfig => ({ id, name: `Computer (Normal)`, kind: 'ai', aiLevel: 'normal', color: '#111' });
const roll = (...faces: Face[]): GameAction => ({ type: 'roll', faces });
const apply = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);
const hold = (index: number): GameAction => ({ type: 'toggleHold', index });
const score = (box: BoxId): GameAction => ({ type: 'score', box });

/** Deep-freezes a state so any in-place mutation by the reducer throws. */
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) freeze(v);
  }
  return value;
}

describe('the reducer never mutates its input', () => {
  it('every action returns a new object and leaves the old one untouched', () => {
    let s = freeze(createGame({ id: 'g', preset: 'classic', players: [human('a'), ai('c')] }));
    const actions: GameAction[] = [roll(1, 2, 3, 4, 5), hold(0), hold(4), roll(6, 6, 6), score('chance'), { type: 'undo' }];
    for (const a of actions) {
      const before = JSON.stringify(s);
      const next = gameReducer(s, a);
      expect(JSON.stringify(s)).toBe(before);
      expect(next).not.toBe(s);
      s = freeze(next);
    }
  });
});

describe('a whole game played by hand', () => {
  it('six players, Classic, every turn passes in seat order and the game ends after 13 rounds', () => {
    const players = ['A', 'B', 'C', 'D', 'E', 'F'].map((n) => human(n));
    let s = createGame({ id: 'six', preset: 'classic', players });
    const rng = createSeededRng('six-players');
    let turns = 0;
    while (s.status === 'playing') {
      expect(s.current).toBe(turns % 6);
      expect(s.round).toBe(Math.floor(turns / 6) + 1);
      s = gameReducer(s, rollAction(s, rng));
      const open = openBoxes(CLASSIC, currentPlayer(s).card);
      s = gameReducer(s, score(open[0]));
      turns++;
    }
    expect(turns).toBe(13 * 6);
    expect(s.round).toBe(13);
    expect(s.players.every((p) => isCardComplete(CLASSIC, p.card))).toBe(true);
    // Everyone's total equals the independent sum of their card.
    s.players.forEach((p, i) => expect(playerTotal(s, i)).toBe(totals(CLASSIC, p.card, p.extraYatzyCount).total));
  });

  it('Scandinavian with forced order fills 15 boxes top to bottom and finishes', () => {
    let s = createGame({ id: 'sc', preset: 'scandinavian', forcedOrder: true, players: [human('a')] });
    const rng = createSeededRng('scandi-forced');
    const order: BoxId[] = [];
    while (s.status === 'playing') {
      s = gameReducer(s, rollAction(s, rng));
      const options = Object.keys(scoreOptions(s)) as BoxId[];
      expect(options).toHaveLength(1);
      order.push(options[0]);
      // Any other box is refused.
      for (const other of SCANDINAVIAN.boxes) if (other !== options[0]) expect(gameReducer(s, score(other))).toBe(s);
      s = gameReducer(s, score(options[0]));
    }
    expect(order).toEqual([...SCANDINAVIAN.boxes]);
    expect(s.round).toBe(15);
    expect(s.players[0].extraYatzyCount).toBe(0);
  });

  it('the game is only finished once the LAST player fills their card, not the first', () => {
    let s = createGame({ id: 'two', preset: 'classic', players: [human('a'), human('b')] });
    // Player A completes every box; B keeps one box open until the very end.
    for (let round = 0; round < 13; round++) {
      s = apply(s, roll(1, 2, 3, 4, 6), score(CLASSIC.boxes[round]));
      if (round < 12) s = apply(s, roll(1, 2, 3, 4, 6), score(CLASSIC.boxes[round]));
    }
    expect(isCardComplete(CLASSIC, s.players[0].card)).toBe(true);
    expect(s.status).toBe('playing');
    expect(s.current).toBe(1);
    s = apply(s, roll(1, 2, 3, 4, 6), score('chance'));
    expect(s.status).toBe('finished');
    expect(s.current).toBe(1);
  });
});

describe('extra Yatzys across a game', () => {
  it('counts a joker Yatzy for each player separately and pays 100 each', () => {
    let s = createGame({ id: 'j', preset: 'classic', players: [human('a'), human('b')] });
    s = apply(s, roll(6, 6, 6, 6, 6), score('yatzy')); // A: 50
    s = apply(s, roll(1, 2, 3, 4, 5), score('largeStraight')); // B: 40
    s = apply(s, roll(6, 6, 6, 6, 6)); // A rolls a second Yatzy
    expect(Object.keys(scoreOptions(s))).toEqual(['sixes']);
    s = apply(s, score('sixes'));
    expect(s.players[0].extraYatzyCount).toBe(1);
    expect(playerTotal(s, 0)).toBe(50 + 30 + 100);
    s = apply(s, roll(2, 2, 2, 2, 2), score('yatzy')); // B: Yatzy 50 (no bonus: the box was open)
    expect(s.players[1].extraYatzyCount).toBe(0);
    expect(playerTotal(s, 1)).toBe(90);
    s = apply(s, roll(6, 6, 6, 6, 6)); // A: third Yatzy, sixes taken → any lower box
    expect(scoreOptions(s)).toMatchObject({ fullHouse: 25, smallStraight: 30, largeStraight: 40, chance: 30 });
    s = apply(s, score('largeStraight'));
    expect(s.players[0].extraYatzyCount).toBe(2);
    expect(playerTotal(s, 0)).toBe(50 + 30 + 40 + 200);
  });

  it('undoing a joker placement also takes back the extra Yatzy count', () => {
    let s = createGame({ id: 'ju', preset: 'classic', players: [human('a')] });
    s = apply(s, roll(3, 3, 3, 3, 3), score('yatzy'), roll(3, 3, 3, 3, 3));
    const scored = apply(s, score('threes'));
    expect(scored.players[0].extraYatzyCount).toBe(1);
    const undone = apply(scored, { type: 'undo' });
    expect(undone.players[0].extraYatzyCount).toBe(0);
    expect(undone.players[0].card).toEqual({ yatzy: 50 });
    expect(undone.dice).toEqual([3, 3, 3, 3, 3]);
    expect(undone.rollsUsed).toBe(1);
  });

  it('a Yatzy scored as 0 elsewhere never earns a bonus later', () => {
    let s = createGame({ id: 'z', preset: 'classic', players: [human('a')] });
    s = apply(s, roll(4, 4, 4, 4, 4), score('ones')); // dumps a Yatzy into Ones for 0
    s = apply(s, roll(4, 4, 4, 4, 4));
    expect(scoreOptions(s)).toMatchObject({ yatzy: 50, fours: 20, fullHouse: 0 });
    s = apply(s, score('yatzy'));
    expect(s.players[0].extraYatzyCount).toBe(0);
  });
});

describe('undo in depth', () => {
  it('restores the previous player, dice, holds and round after the turn passed', () => {
    let s = createGame({ id: 'u', preset: 'classic', players: [human('a'), human('b')] });
    s = apply(s, roll(1, 1, 2, 2, 3), hold(0), hold(1), roll(5, 5, 5), score('chance')); // A, round 1
    s = apply(s, roll(2, 2, 2, 2, 2), score('twos')); // B, round 1 → round 2, A to play
    expect(s).toMatchObject({ current: 0, round: 2 });
    const undone = apply(s, { type: 'undo' });
    expect(undone).toMatchObject({ current: 1, round: 1, rollsUsed: 1, dice: [2, 2, 2, 2, 2] });
    expect(undone.players[1].card).toEqual({});
    expect(undone.players[0].card).toEqual({ chance: 17 });
    expect(undone.undo).toBeNull();
  });

  it('a hold after scoring is refused, so the undo stays available until the real next roll', () => {
    let s = createGame({ id: 'u2', preset: 'classic', players: [human('a')] });
    s = apply(s, roll(6, 6, 6, 6, 1), score('sixes'));
    expect(gameReducer(s, hold(0))).toBe(s);
    expect(s.undo).not.toBeNull();
    s = apply(s, roll(1, 1, 1, 1, 1));
    expect(s.undo).toBeNull();
  });

  it('cannot be chained: two scores, one undo, no second undo', () => {
    let s = createGame({ id: 'u3', preset: 'classic', players: [human('a')] });
    s = apply(s, roll(1, 1, 1, 1, 1), score('ones'), roll(2, 2, 2, 2, 2), score('twos'));
    s = apply(s, { type: 'undo' });
    expect(s.players[0].card).toEqual({ ones: 5 });
    expect(gameReducer(s, { type: 'undo' })).toBe(s);
  });
});

describe('scoreOptions and the pad agree', () => {
  it('scoreOptions equals potentialScores for the current player in free and forced order', () => {
    for (const forcedOrder of [false, true]) {
      let s = createGame({ id: 'p', preset: 'scandinavian', forcedOrder, players: [human('a')] });
      const rng = createSeededRng(`options-${forcedOrder}`);
      for (let i = 0; i < 15; i++) {
        s = gameReducer(s, rollAction(s, rng));
        const expected = potentialScores(SCANDINAVIAN, currentPlayer(s).card, s.dice, forcedOrder);
        expect(scoreOptions(s)).toEqual(expected);
        s = gameReducer(s, score(Object.keys(expected)[0] as BoxId));
      }
      expect(s.status).toBe('finished');
    }
  });
});

describe('rollAction only draws for free dice, in order', () => {
  it('maps drawn faces onto the unheld positions and leaves held faces alone', () => {
    let s = createGame({ id: 'r', preset: 'classic', players: [human('a')] });
    s = apply(s, roll(1, 2, 3, 4, 5), hold(1), hold(3));
    const scripted: Rng = { nextFace: (() => { const seq: Face[] = [6, 6, 6]; return () => seq.shift()!; })() };
    const action = rollAction(s, scripted);
    expect(action).toEqual({ type: 'roll', faces: [6, 6, 6] });
    s = gameReducer(s, action);
    expect(s.dice).toEqual([6, 2, 6, 4, 6]);
    expect(s.held).toEqual([false, true, false, true, false]);
  });

  it('with every die held the roll draws nothing but still counts as a roll', () => {
    let s = createGame({ id: 'r2', preset: 'classic', players: [human('a')] });
    s = apply(s, roll(1, 2, 3, 4, 5), hold(0), hold(1), hold(2), hold(3), hold(4));
    const calls = jest.fn<Face, []>(() => 6);
    const action = rollAction(s, { nextFace: calls });
    expect(action).toEqual({ type: 'roll', faces: [] });
    expect(calls).not.toHaveBeenCalled();
    s = gameReducer(s, action);
    expect(s).toMatchObject({ dice: [1, 2, 3, 4, 5], rollsUsed: 2 });
    expect(s.faceTally?.human).toEqual([1, 1, 1, 1, 1, 0]);
  });
});

describe('randomised play keeps every invariant (fuzz)', () => {
  /** Plays random legal and illegal actions; checks invariants after each one (plain checks: expect() per step is slow). */
  function fuzz(seed: string, config: { preset: 'classic' | 'scandinavian'; forcedOrder: boolean; players: PlayerConfig[] }) {
    const rng = createSeededRng(seed);
    const pick = (n: number) => (rng.nextFace() - 1) % n;
    let s = createGame({ id: seed, ...config });
    const preset = PRESETS[config.preset];
    const problems: string[] = [];
    const check = (ok: boolean, msg: string) => {
      if (!ok && problems.length < 10) problems.push(`${seed}: ${msg}`);
    };
    const filled = (st: GameState) => st.players.reduce((n, p) => n + Object.keys(p.card).length, 0);
    let steps = 0;
    while (s.status === 'playing' && steps++ < 20_000) {
      const choice = rng.nextFace();
      let next: GameState;
      if (choice <= 2) next = gameReducer(s, rollAction(s, rng));
      else if (choice === 3) next = gameReducer(s, hold(pick(7) - 1)); // -1 and 5 are out of range on purpose
      else if (choice === 4 && rng.nextFace() === 1) next = gameReducer(s, { type: 'undo' });
      else if (choice === 4) {
        const open = openBoxes(preset, currentPlayer(s).card);
        next = gameReducer(s, score(open[pick(open.length)]));
      } else next = gameReducer(s, score(preset.boxes[pick(preset.boxes.length)])); // often illegal

      check(next.rollsUsed >= 0 && next.rollsUsed <= MAX_ROLLS, `rollsUsed ${next.rollsUsed}`);
      check(next.dice.length === DICE_COUNT && next.held.length === DICE_COUNT, 'dice/held length');
      check(next.dice.every((d) => d >= 1 && d <= 6), `faces ${next.dice.join('')}`);
      if (next.rollsUsed === 0) check(next.held.every((h) => !h), 'holds not reset');
      check(next.current >= 0 && next.current < config.players.length, `current ${next.current}`);
      for (const p of next.players) {
        for (const [box, v] of Object.entries(p.card)) {
          check((preset.boxes as readonly string[]).includes(box), `foreign box ${box}`);
          check(v >= 0, `negative ${box}`);
        }
        if (!preset.joker) check(p.extraYatzyCount === 0, 'extra Yatzy outside Classic');
      }
      const finishedNow = next.players.every((p) => isCardComplete(preset, p.card));
      check((next.status === 'finished') === finishedNow, 'status vs cards');
      check(Math.abs(filled(next) - filled(s)) <= 1, 'more than one box changed in a step');
      s = next;
    }
    expect(problems).toEqual([]);
    expect(s.status).toBe('finished');
    return s;
  }

  it.each([
    ['classic free, 1 player', { preset: 'classic' as const, forcedOrder: false, players: [human('a')] }],
    ['classic forced, 3 players', { preset: 'classic' as const, forcedOrder: true, players: [human('a'), ai('b'), human('c')] }],
    ['scandinavian free, 2 players', { preset: 'scandinavian' as const, forcedOrder: false, players: [human('a'), human('b')] }],
    ['scandinavian forced, 6 players', { preset: 'scandinavian' as const, forcedOrder: true, players: ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => human(n)) }],
  ])('%s', (_name, config) => {
    for (let i = 0; i < 5; i++) fuzz(`fuzz-${_name}-${i}`, config);
  });

  it('the face tally always equals the number of faces actually drawn, split by who rolled', () => {
    const rng = createSeededRng('tally');
    let s = createGame({ id: 't', preset: 'classic', players: [human('a'), ai('c')] });
    const drawn = { human: [0, 0, 0, 0, 0, 0], ai: [0, 0, 0, 0, 0, 0] };
    while (s.status === 'playing') {
      const action = rollAction(s, rng);
      if (action.type === 'roll') for (const f of action.faces) drawn[currentPlayer(s).kind][f - 1]++;
      s = gameReducer(s, action);
      if (s.rollsUsed === MAX_ROLLS || rng.nextFace() > 3) {
        const open = openBoxes(CLASSIC, currentPlayer(s).card);
        s = gameReducer(s, score(open[rng.nextFace() % open.length]));
      }
    }
    expect(s.faceTally).toEqual(drawn);
    expect(canRoll(s)).toBe(false);
  });
});
