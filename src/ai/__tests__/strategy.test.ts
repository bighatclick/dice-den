import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Face } from '../../engine/dice';
import { createGame, gameReducer, playerTotal, rollAction, type AiLevel, type GameState } from '../../engine/game';
import { createSeededRng } from '../../engine/rng';
import { CLASSIC, SCANDINAVIAN, type RulePreset } from '../../engine/rules/presets';
import type { Scorecard } from '../../engine/scoring';
import { nextAiStep } from '../index';
import { boxValue, decide, holdMask, outcomes, type AiView } from '../strategy';

const view = (dice: Face[], over: Partial<AiView> = {}): AiView => ({
  preset: CLASSIC,
  card: {},
  extraYatzyCount: 0,
  forcedOrder: false,
  dice,
  rollsUsed: 1,
  ...over,
});
const kept = (v: AiView, level: AiLevel) => {
  const d = decide(v, level);
  if (d.type !== 'keep') throw new Error(`expected keep, got ${JSON.stringify(d)}`);
  return v.dice.filter((_, i) => d.held[i]).sort();
};

describe('outcomes', () => {
  it.each([0, 1, 2, 5])('lists every sorted roll of %i dice with probabilities summing to 1', (n) => {
    const all = outcomes(n);
    expect(all).toHaveLength([1, 6, 21, 56, 126, 252][n]);
    expect(all.reduce((s, o) => s + o.p, 0)).toBeCloseTo(1, 12);
  });
});

describe('decide', () => {
  it.each<AiLevel>(['normal', 'expert'])('%s scores a Yatzy at once', (level) => {
    expect(decide(view([4, 4, 4, 4, 4]), level)).toEqual({ type: 'score', box: 'yatzy' });
  });

  it.each<AiLevel>(['normal', 'expert'])('%s takes a large straight at once', (level) => {
    expect(decide(view([2, 3, 4, 5, 6]), level)).toEqual({ type: 'score', box: 'largeStraight' });
  });

  it.each<AiLevel>(['normal', 'expert'])('%s keeps four sixes and rolls for more', (level) => {
    expect(kept(view([6, 2, 6, 6, 6]), level)).toEqual([6, 6, 6, 6]);
  });

  it('expert keeps an open-ended four-run for the large straight', () => {
    expect(kept(view([2, 3, 4, 5, 2], { card: { smallStraight: 30 } }), 'expert')).toEqual([2, 3, 4, 5]);
  });

  it('scores the best box after the last roll', () => {
    expect(decide(view([5, 5, 5, 2, 2], { rollsUsed: 3 }), 'expert')).toEqual({ type: 'score', box: 'fullHouse' });
  });

  it('only scores boxes the rules allow (forced order, joker)', () => {
    expect(decide(view([6, 6, 6, 6, 6], { forcedOrder: true, rollsUsed: 3 }), 'expert')).toEqual({ type: 'score', box: 'ones' });
    const card: Scorecard = { yatzy: 50, threes: 9 };
    const d = decide(view([3, 3, 3, 3, 3], { card, rollsUsed: 3 }), 'normal');
    expect(d.type === 'score' && d.box).not.toBe('threes');
    expect(decide(view([3, 3, 3, 3, 3], { card: { yatzy: 50 }, rollsUsed: 3 }), 'normal')).toEqual({ type: 'score', box: 'threes' });
  });

  it('easy picks among its top 3 choices using the chooser', () => {
    const dice: Face[] = [1, 2, 3, 4, 6];
    const picks = new Set([0, 1, 2].map((n) => JSON.stringify(decide(view(dice, { rollsUsed: 3 }), 'easy', () => n))));
    expect(picks.size).toBe(3);
    // The chooser is clamped, so a bad chooser cannot pick outside the top 3.
    expect(decide(view(dice, { rollsUsed: 3 }), 'easy', () => 99)).toEqual(decide(view(dice, { rollsUsed: 3 }), 'easy', () => 2));
  });

  it('works with the Scandinavian preset', () => {
    expect(decide(view([1, 2, 3, 4, 5], { preset: SCANDINAVIAN }), 'expert')).toEqual({ type: 'score', box: 'smallStraight' });
  });

  it('refuses to decide before the first roll', () => {
    expect(() => decide(view([1, 1, 1, 1, 1], { rollsUsed: 0 }), 'normal')).toThrow();
  });

  it('values the upper bonus', () => {
    const v = view([5, 5, 5, 5, 1], { card: { ones: 3, twos: 6, threes: 9, fours: 12, sixes: 18 } });
    expect(boxValue(v, 'fives', v.dice)).toBeGreaterThan(boxValue(v, 'fourKind', v.dice));
  });
});

describe('holdMask', () => {
  it('holds the leftmost dice that make up the kept set', () => {
    expect(holdMask([6, 2, 6, 6, 1], [6, 6])).toEqual([true, false, true, false, false]);
    expect(holdMask([1, 2, 3, 4, 5], [])).toEqual([false, false, false, false, false]);
  });
});

/** Plays a whole game for the given levels with the shared dice RNG, only through visible state. */
function playGame(levels: AiLevel[], seed: string, preset: RulePreset = CLASSIC): GameState {
  const rng = createSeededRng(seed);
  // Deterministic stand-in for Easy's random pick.
  let n = 0;
  const choose = (k: number) => Math.floor((Math.sin(++n * 99.7) * 0.5 + 0.5) * k);
  let game = createGame({
    id: seed,
    preset: preset.id,
    players: levels.map((aiLevel, i) => ({ id: `c${i}`, name: `C${i}`, kind: 'ai', aiLevel, color: '#000' })),
  });
  for (let guard = 0; game.status === 'playing'; guard++) {
    if (guard > 2000) throw new Error('AI game did not finish');
    const step = nextAiStep(game, choose)!;
    const next = gameReducer(game, step.type === 'roll' ? rollAction(game, rng) : step);
    if (next === game) throw new Error(`AI made an invalid move: ${JSON.stringify(step)}`);
    game = next;
  }
  return game;
}

describe('full computer games', () => {
  it('finish with only valid moves at every level and in both presets', () => {
    const game = playGame(['easy', 'normal', 'expert'], 'levels');
    expect(game.status).toBe('finished');
    expect(playGame(['expert'], 'scandi', SCANDINAVIAN).status).toBe('finished');
  });

  it('score in sensible ranges and Expert beats Easy on average', () => {
    const avg = (level: AiLevel) => {
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += playerTotal(playGame([level], `avg-${i}`), 0);
      return sum / 12;
    };
    const easy = avg('easy');
    const expert = avg('expert');
    // Benchmarked over 150 games: Easy ~146, Normal ~235, Expert ~237 (Classic).
    expect(expert).toBeGreaterThan(200);
    expect(expert).toBeGreaterThan(easy + 40);
  });

  it('returns no step when it is not a computer turn', () => {
    const g = createGame({ id: 'h', preset: 'classic', players: [{ id: 'p', name: 'You', kind: 'human', color: '#000' }] });
    expect(nextAiStep(g)).toBeNull();
  });
});

it('AI code never imports the RNG (CLAUDE.md: AIs never get the RNG)', () => {
  const dir = join(__dirname, '..');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    expect(readFileSync(join(dir, file), 'utf8')).not.toMatch(/engine\/rng|expo-crypto|state\/rng/);
  }
});
