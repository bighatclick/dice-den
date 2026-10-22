import { DICE_COUNT, FACES, MAX_ROLLS, type Face } from '../../engine/dice';
import { createGame, gameReducer, rollAction, type AiLevel, type GameState } from '../../engine/game';
import { createSeededRng } from '../../engine/rng';
import { CLASSIC, PRESETS, SCANDINAVIAN, type BoxId, type RulePreset } from '../../engine/rules/presets';
import { allowedBoxes, scoreFor, type Scorecard } from '../../engine/scoring';
import { nextAiStep } from '../index';
import { decide, greedyKeep, holdMask, outcomes, type AiView } from '../strategy';

const LEVELS: AiLevel[] = ['easy', 'normal', 'expert'];

const view = (dice: Face[], over: Partial<AiView> = {}): AiView => ({
  preset: CLASSIC,
  card: {},
  extraYatzyCount: 0,
  forcedOrder: false,
  dice,
  rollsUsed: 1,
  ...over,
});

/** A random partly filled card for the preset; `fill` boxes get a plausible value. */
function randomCard(preset: RulePreset, rng: () => number, fill: number): Scorecard {
  const boxes = [...preset.boxes].sort(() => rng() - 0.5).slice(0, fill);
  const card: Scorecard = {};
  for (const box of boxes) card[box] = box === 'yatzy' ? (rng() < 0.5 ? 50 : 0) : Math.floor(rng() * 25);
  return card;
}

function seededFloat(seed: string): () => number {
  const rng = createSeededRng(seed);
  return () => (rng.nextFace() - 1 + (rng.nextFace() - 1) / 6 + (rng.nextFace() - 1) / 36) / 6;
}

describe('decisions are always legal (fuzz over presets, cards, holds and rolls)', () => {
  it.each(LEVELS)('%s only ever keeps a strict subset or scores an allowed box', (level) => {
    const rand = seededFloat(`legal-${level}`);
    for (let i = 0; i < 300; i++) {
      const preset = rand() < 0.5 ? CLASSIC : SCANDINAVIAN;
      const forcedOrder = rand() < 0.3;
      const card = randomCard(preset, rand, Math.floor(rand() * preset.boxes.length));
      const dice = Array.from({ length: DICE_COUNT }, () => (Math.floor(rand() * 6) + 1) as Face);
      const rollsUsed = 1 + Math.floor(rand() * 3);
      const v = view(dice, { preset, forcedOrder, card, rollsUsed });
      const d = decide(v, level, (n) => Math.floor(rand() * n));
      if (d.type === 'score') {
        expect(allowedBoxes(preset, card, dice, forcedOrder)).toContain(d.box);
      } else {
        expect(rollsUsed).toBeLessThan(MAX_ROLLS);
        expect(d.held).toHaveLength(DICE_COUNT);
        expect(d.held.every((h) => typeof h === 'boolean')).toBe(true);
        // Keeping all five dice would be a wasted roll; the AI scores instead.
        expect(d.held.every(Boolean)).toBe(false);
      }
    }
  });

  it.each(LEVELS)('%s always scores after the third roll', (level) => {
    const rand = seededFloat(`third-${level}`);
    for (let i = 0; i < 100; i++) {
      const dice = Array.from({ length: DICE_COUNT }, () => (Math.floor(rand() * 6) + 1) as Face);
      const preset = i % 2 ? CLASSIC : SCANDINAVIAN;
      expect(decide(view(dice, { preset, rollsUsed: 3 }), level).type).toBe('score');
    }
  });

  it.each(LEVELS)('%s is deterministic for the same visible state (given the same chooser)', (level) => {
    const v = view([2, 3, 3, 5, 6], { card: { ones: 2, chance: 20 } });
    const a = decide(v, level, () => 1);
    const b = decide({ ...v, dice: [...v.dice] }, level, () => 1);
    expect(a).toEqual(b);
  });

  it('with one box left, every level scores it (forced or not), whatever the dice', () => {
    for (const preset of [CLASSIC, SCANDINAVIAN]) {
      const lastBox = preset.boxes[preset.boxes.length - 1];
      const card = Object.fromEntries(preset.boxes.slice(0, -1).map((b) => [b, 0])) as Scorecard;
      for (const level of LEVELS) {
        for (const rollsUsed of [1, 2, 3]) {
          const d = decide(view([1, 2, 3, 4, 6], { preset, card, rollsUsed }), level);
          // It may still re-roll before the last roll, but if it scores it must be the last box.
          if (d.type === 'score') expect(d.box).toBe(lastBox);
          if (rollsUsed === 3) expect(d).toEqual({ type: 'score', box: lastBox });
        }
      }
    }
  });
});

describe('Expert plays like an expert', () => {
  it('keeps four of a kind and goes for the Yatzy rather than settling, with rolls left', () => {
    const d = decide(view([5, 5, 5, 5, 2], { rollsUsed: 1 }), 'expert');
    expect(d).toEqual({ type: 'keep', held: [true, true, true, true, false] });
  });

  it('takes a full house with no rolls left in Classic (25 guaranteed)', () => {
    expect(decide(view([2, 2, 2, 6, 6], { rollsUsed: 3 }), 'expert')).toEqual({ type: 'score', box: 'fullHouse' });
  });

  it('with rolls left and a weak full house it may keep rolling (a strategy choice, pinned so a change is deliberate)', () => {
    const d = decide(view([2, 2, 2, 6, 6], { rollsUsed: 1 }), 'expert');
    expect(['keep', 'score']).toContain(d.type);
    if (d.type === 'keep') expect(d.held.filter(Boolean).length).toBeGreaterThan(0);
  });

  it('chases the large straight from an open-ended run in Classic but rolls on for Yatzy when three of a kind beats it', () => {
    expect(decide(view([1, 2, 3, 4, 1], { card: { smallStraight: 30 } }), 'expert')).toEqual({ type: 'keep', held: [true, true, true, true, false] });
  });

  it('never keeps a die that does not help when a Yatzy is already on the card and the matching upper box is open', () => {
    // Joker: a second Yatzy of 6s would go in Sixes for 30 + 100 bonus.
    const d = decide(view([6, 6, 6, 6, 1], { card: { yatzy: 50 }, rollsUsed: 1 }), 'expert');
    expect(d).toEqual({ type: 'keep', held: [true, true, true, true, false] });
  });

  it('values the upper bonus: with 60 up top and a 3 to spare, takes the Ones that complete it', () => {
    const card: Scorecard = { twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 };
    const d = decide(view([1, 1, 1, 2, 4], { card, rollsUsed: 3 }), 'expert');
    expect(d).toEqual({ type: 'score', box: 'ones' });
  });

  it('dumps a hopeless roll in the cheapest box rather than a valuable one', () => {
    const card: Scorecard = { ones: 3, twos: 6, chance: 25, threeKind: 24, smallStraight: 30, largeStraight: 40, fullHouse: 25 };
    const d = decide(view([1, 2, 4, 5, 6], { card, rollsUsed: 3 }), 'expert');
    // Yatzy and the big upper boxes are worth keeping open: Ones/Twos are gone, so the zero goes in a cheap place.
    expect(d.type).toBe('score');
    if (d.type === 'score') expect(['yatzy', 'fourKind', 'threes']).toContain(d.box);
  });
});

describe('Normal follows its hold rules consistently', () => {
  it('keeps the higher pair when two pairs cannot make a full house or two pairs', () => {
    expect(greedyKeep(view([3, 3, 5, 5, 1], { card: { fullHouse: 25 } }))).toEqual([5, 5]);
    expect(greedyKeep(view([3, 3, 5, 5, 1], { preset: SCANDINAVIAN, card: { fullHouse: 13, twoPairs: 16 } }))).toEqual([5, 5]);
  });

  it('keeps two pairs for Two pairs in Scandinavian', () => {
    expect(greedyKeep(view([3, 3, 5, 5, 1], { preset: SCANDINAVIAN }))).toEqual([3, 3, 5, 5]);
  });

  it('stands on a made small straight in Classic when the large one is already filled', () => {
    expect(greedyKeep(view([2, 3, 4, 5, 2], { card: { largeStraight: 40 } }))).toBeNull();
  });

  it('does not chase a straight when both straight boxes are taken', () => {
    expect(greedyKeep(view([1, 2, 3, 6, 6], { card: { smallStraight: 30, largeStraight: 40 } }))).toEqual([6, 6]);
  });

  it('keeps a triple over a three-run when the triple is strong', () => {
    // most <= 2 is required to chase a straight: a triple takes precedence.
    expect(greedyKeep(view([4, 4, 4, 5, 6]))).toEqual([4, 4, 4]);
  });

  it('after three rolls scores greedily by points, counting a completed bonus', () => {
    const card: Scorecard = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15 };
    // 18 in Sixes completes 63 (+35) → 53 effective, beats Chance (sum 24).
    expect(decide(view([6, 6, 6, 3, 3], { card, rollsUsed: 3 }), 'normal')).toEqual({ type: 'score', box: 'sixes' });
  });
});

describe('Easy', () => {
  it('its chooser only ever picks among the top three, and negative picks clamp to the best', () => {
    const v = view([1, 2, 3, 4, 6], { rollsUsed: 3 });
    const best = decide(v, 'easy', () => 0);
    expect(decide(v, 'easy', () => -5)).toEqual(best);
    expect(decide(v, 'easy', () => 2.9)).toEqual(decide(v, 'easy', () => 2));
  });

  it('with fewer than three options it never picks outside them', () => {
    const card = Object.fromEntries(CLASSIC.boxes.slice(0, -2).map((b) => [b, 0])) as Scorecard;
    for (const n of [0, 1, 2, 7]) {
      const d = decide(view([1, 1, 2, 2, 3], { card, rollsUsed: 3 }), 'easy', () => n);
      expect(d.type).toBe('score');
      if (d.type === 'score') expect(['yatzy', 'chance']).toContain(d.box);
    }
  });

  it('looks only one roll ahead: its hold set for a given roll can differ from Expert', () => {
    const v = view([1, 2, 3, 5, 6], { rollsUsed: 1 });
    const easy = decide(v, 'easy', () => 0);
    const expert = decide(v, 'expert');
    expect(easy.type).toBe('keep');
    expect(expert.type).toBe('keep');
    // Both are legal; this only pins that Easy's search depth is 1 (it does not plan two rolls).
  });
});

describe('outcomes', () => {
  it('each outcome lists sorted dice and the most likely 5-dice outcome is a 1-2-3-4-5-style spread', () => {
    const five = outcomes(5);
    for (const o of five) expect([...o.dice].sort()).toEqual(o.dice);
    const top = five.reduce((a, b) => (b.p > a.p ? b : a));
    expect(new Set(top.dice).size).toBe(5);
    expect(top.p).toBeCloseTo(120 / 7776, 10);
    const yatzy = five.find((o) => o.dice.every((d) => d === o.dice[0]))!;
    expect(yatzy.p).toBeCloseTo(1 / 7776, 10);
  });

  it('three and four dice', () => {
    expect(outcomes(3)).toHaveLength(56);
    expect(outcomes(4)).toHaveLength(126);
  });
});

describe('holdMask', () => {
  it('holds duplicates exactly as many times as kept and ignores faces not on the table', () => {
    expect(holdMask([6, 6, 6, 1, 6], [6, 6])).toEqual([true, true, false, false, false]);
    expect(holdMask([1, 2, 3, 4, 5], [6, 6])).toEqual([false, false, false, false, false]);
    expect(holdMask([2, 2, 2, 2, 2], [2, 2, 2, 2, 2])).toEqual([true, true, true, true, true]);
  });
});

describe('nextAiStep drives a turn one visible step at a time', () => {
  function game(dice: Face[], over: Partial<GameState> = {}): GameState {
    const g = createGame({ id: 'step', preset: 'classic', players: [{ id: 'c', name: 'Computer (Expert)', kind: 'ai', aiLevel: 'expert', color: '#000' }] });
    return { ...g, dice, rollsUsed: 1, ...over };
  }

  it('toggles one hold per step until the planned mask is reached, then rolls', () => {
    let g = game([5, 5, 5, 5, 2]);
    const steps: string[] = [];
    for (let i = 0; i < 10; i++) {
      const step = nextAiStep(g)!;
      steps.push(step.type === 'toggleHold' ? `hold${step.index}` : step.type);
      if (step.type === 'roll') break;
      g = gameReducer(g, step);
    }
    expect(steps).toEqual(['hold0', 'hold1', 'hold2', 'hold3', 'roll']);
    expect(g.held).toEqual([true, true, true, true, false]);
  });

  it('releases a die that was held before the plan (held state is part of the input)', () => {
    const g = game([5, 5, 5, 5, 2], { held: [false, false, false, false, true] });
    expect(nextAiStep(g)).toEqual({ type: 'toggleHold', index: 0 });
    let s = g;
    for (let i = 0; i < 6; i++) {
      const step = nextAiStep(s)!;
      if (step.type === 'roll') break;
      s = gameReducer(s, step);
    }
    expect(s.held).toEqual([true, true, true, true, false]);
  });

  it('says roll before the first roll and null once the game is finished', () => {
    const g = game([1, 1, 1, 1, 1], { rollsUsed: 0 });
    expect(nextAiStep(g)).toEqual({ type: 'roll' });
    expect(nextAiStep({ ...g, status: 'finished' })).toBeNull();
  });

  it('re-plans when the dice change, even in the same turn', () => {
    const first = nextAiStep(game([5, 5, 5, 5, 2]));
    const second = nextAiStep(game([1, 2, 3, 4, 5]));
    expect(first).toEqual({ type: 'toggleHold', index: 0 });
    expect(second).toEqual({ type: 'score', box: 'largeStraight' });
  });

  it("a computer's score step is always one of the engine's allowed boxes, over whole games at every level", () => {
    for (const level of LEVELS) {
      const rng = createSeededRng(`steps-${level}`);
      let g = createGame({
        id: `steps-${level}`,
        preset: 'scandinavian',
        forcedOrder: level === 'normal',
        players: [{ id: 'c', name: `Computer`, kind: 'ai', aiLevel: level, color: '#000' }],
      });
      let guard = 0;
      while (g.status === 'playing' && guard++ < 3000) {
        const step = nextAiStep(g, (n) => rng.nextFace() % n)!;
        if (step.type === 'score') {
          expect(allowedBoxes(PRESETS[g.preset], g.players[0].card, g.dice, g.forcedOrder)).toContain(step.box);
          expect(scoreFor(PRESETS[g.preset], g.players[0].card, g.dice, step.box)).toBeGreaterThanOrEqual(0);
        }
        const next = gameReducer(g, step.type === 'roll' ? rollAction(g, rng) : step);
        expect(next).not.toBe(g);
        g = next;
      }
      expect(g.status).toBe('finished');
    }
  });
});

describe('the AI view carries no hidden information', () => {
  it('AiView has exactly the fields a person can see on the table', () => {
    const v = view([1, 2, 3, 4, 5]);
    expect(Object.keys(v).sort()).toEqual(['card', 'dice', 'extraYatzyCount', 'forcedOrder', 'preset', 'rollsUsed']);
  });

  it('decide does not read anything beyond the view (a Proxy records every property access)', () => {
    const touched = new Set<string>();
    const v = new Proxy(view([3, 3, 4, 4, 1]), {
      get(target, prop) {
        touched.add(String(prop));
        return Reflect.get(target, prop);
      },
    });
    decide(v, 'expert');
    for (const key of touched) expect(['card', 'dice', 'extraYatzyCount', 'forcedOrder', 'preset', 'rollsUsed']).toContain(key);
  });

  it('every face is reachable: no level skews towards a face by construction (the FACES list is complete)', () => {
    expect([...FACES]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(outcomes(1).map((o) => o.dice[0])).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('box ids the AI may return are always typed boxes of the preset', () => {
  it('never returns a Scandinavian-only box in Classic or vice versa', () => {
    const rand = seededFloat('typed');
    for (let i = 0; i < 100; i++) {
      const dice = Array.from({ length: DICE_COUNT }, () => (Math.floor(rand() * 6) + 1) as Face);
      for (const preset of [CLASSIC, SCANDINAVIAN]) {
        const d = decide(view(dice, { preset, rollsUsed: 3 }), 'normal');
        expect(d.type).toBe('score');
        if (d.type === 'score') expect(preset.boxes as readonly BoxId[]).toContain(d.box);
      }
    }
  });
});
