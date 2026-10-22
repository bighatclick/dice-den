import { createDailyRng } from '../../engine/rng';
import { CLASSIC, SCANDINAVIAN } from '../../engine/rules/presets';
import type { PlayerConfig } from '../../engine/game';
import { memoryStore, scriptDice, setUpAppData } from '../../testing/appData';
import { getAppData, initAppData, isReadOnly, updateAppData } from '../appData';
import { canUndo, useGameStore } from '../gameStore';
import { setGameRng } from '../rng';
import { Repository } from '../../data/repository';
import { createDefaultData } from '../../data/schema';

const you: PlayerConfig = { id: 'p1', name: 'You', kind: 'human', color: '#C77D4E' };
const mom: PlayerConfig = { id: 'p2', name: 'Mom', kind: 'human', color: '#5E9BC6' };
const cpu = (level: 'easy' | 'normal' | 'expert', id = 'c'): PlayerConfig => ({ id, name: `Computer (${level})`, kind: 'ai', aiLevel: level, color: '#55707E' });
const store = () => useGameStore.getState();
const game = () => store().game!;

beforeEach(() => {
  useGameStore.setState({ game: null, rollSeq: 0, newUnlocks: [] });
  setGameRng(null);
});

describe('starting games', () => {
  it('a new start replaces the game in progress and gets a fresh id', () => {
    setUpAppData();
    const first = store().start({ players: [you] });
    const second = store().start({ players: [you, mom] });
    expect(second.id).not.toBe(first.id);
    expect(getAppData().inProgress?.id).toBe(second.id);
    expect(getAppData().gameLog).toHaveLength(0); // an abandoned game is never logged
  });

  it('ids are unique over many starts', () => {
    setUpAppData();
    const ids = new Set(Array.from({ length: 200 }, () => store().start({ players: [you] }).id));
    expect(ids.size).toBe(200);
  });

  it('a daily game is always Classic, free order and solo, even if settings say otherwise', () => {
    setUpAppData();
    updateAppData((d) => ({ ...d, settings: { ...d.settings, preset: 'scandinavian', forcedOrder: true } }));
    const g = store().startDaily('2026-10-17', you);
    expect(g).toMatchObject({ mode: 'daily', preset: 'classic', forcedOrder: false, id: 'daily-2026-10-17' });
    expect(g.players).toHaveLength(1);
  });

  it('a replay gets its own id but the same dice', () => {
    setUpAppData();
    const expected = createDailyRng('2026-10-17');
    const first = Array.from({ length: 5 }, () => expected.nextFace());
    store().startDaily('2026-10-17', you, 2);
    expect(game().id).toBe('daily-2026-10-17-r2');
    store().roll();
    expect(game().dice).toEqual(first);
  });
});

describe('the one shared RNG', () => {
  it('a normal game draws from the game RNG for people and computers alike', () => {
    setUpAppData();
    scriptDice([1, 2, 3, 4, 5, 6]);
    store().start({ players: [you, cpu('normal')] });
    store().roll();
    expect(game().dice).toEqual([1, 2, 3, 4, 5]);
    store().score('chance');
    store().aiStep(); // computer rolls from the same sequence
    expect(game().dice).toEqual([6, 1, 2, 3, 4]);
  });

  it('a daily game ignores the game RNG entirely', () => {
    setUpAppData();
    scriptDice([6, 6, 6, 6, 6]);
    store().startDaily('2026-10-17', you);
    store().roll();
    const seeded = createDailyRng('2026-10-17');
    expect(game().dice).toEqual(Array.from({ length: 5 }, () => seeded.nextFace()));
  });

  it('switching between a daily and a normal game keeps each sequence where it was', () => {
    setUpAppData();
    const seeded = createDailyRng('2026-10-17');
    const faces = Array.from({ length: 15 }, () => seeded.nextFace());
    store().startDaily('2026-10-17', you);
    store().roll();
    store().roll();
    const daily = game();
    scriptDice([2, 2, 2, 2, 2]);
    store().start({ players: [you] });
    store().roll();
    expect(game().dice).toEqual([2, 2, 2, 2, 2]);
    // Back to the daily (as a resume would): the third roll continues from draw 10.
    useGameStore.setState({ game: daily });
    store().roll();
    expect(game().dice).toEqual(faces.slice(10, 15));
  });
});

describe('autosave covers every mutation, including computer turns and undo', () => {
  it('each store action writes a blob that equals the in-memory game', () => {
    const kv = setUpAppData();
    scriptDice([5, 5, 5, 1, 2]);
    const saved = () => JSON.parse(kv.data.get('root')!).inProgress;
    store().start({ players: [you, cpu('easy')] });
    expect(saved()).toEqual(game());
    store().roll();
    expect(saved()).toEqual(game());
    store().toggleHold(0);
    store().toggleHold(0);
    expect(saved()).toEqual(game());
    store().score('fives');
    expect(saved()).toEqual(game());
    store().undo();
    expect(saved()).toEqual(game());
    store().score('fives');
    store().skipAiTurn();
    expect(saved()).toEqual(game());
    expect(saved().current).toBe(0);
  });

  it('a relaunch during the computer turn resumes with the computer still to play', () => {
    const kv = setUpAppData();
    scriptDice([3, 3, 3, 3, 3]);
    store().start({ players: [you, cpu('normal')] });
    store().roll();
    store().score('threes');
    store().aiStep(); // computer has rolled once
    const mid = game();
    expect(mid.current).toBe(1);
    expect(mid.rollsUsed).toBe(1);
    useGameStore.setState({ game: null });
    setUpAppData(kv);
    store().hydrate();
    expect(game()).toEqual(mid);
    expect(store().aiStep()).toBe(true);
  });

  it('in read-only safe mode play continues in memory and nothing is written', () => {
    const kv = memoryStore();
    kv.set('root', '{broken');
    initAppData(new Repository(kv));
    expect(isReadOnly()).toBe(true);
    scriptDice([1, 1, 1, 1, 1]);
    store().start({ players: [you] });
    store().roll();
    store().score('ones');
    expect(game().players[0].card).toEqual({ ones: 5 });
    expect(kv.data.get('root')).toBe('{broken');
  });
});

describe('undo rules in the store', () => {
  it("a person can undo their own score but not the computer's, and never after the game ends", () => {
    setUpAppData();
    scriptDice([4, 4, 4, 4, 4]);
    store().start({ players: [you, cpu('expert')] });
    store().roll();
    store().score('fours');
    expect(canUndo(game())).toBe(true);
    store().skipAiTurn();
    expect(game().current).toBe(0);
    expect(canUndo(game())).toBe(false);
    const before = game();
    store().undo();
    expect(game()).toBe(before);
  });

  it('in pass-and-play the undo belongs to whoever scored last, until the next person rolls', () => {
    setUpAppData();
    scriptDice([2, 3, 4, 5, 6]);
    store().start({ players: [you, mom] });
    store().roll();
    store().score('largeStraight');
    expect(game().current).toBe(1);
    expect(canUndo(game())).toBe(true);
    store().undo();
    expect(game()).toMatchObject({ current: 0, rollsUsed: 1 });
    store().score('largeStraight');
    store().roll(); // Mom rolls: You's undo is gone
    expect(canUndo(game())).toBe(false);
  });
});

describe('computer turns through the store', () => {
  it('aiStep is false on a human turn and true for each computer step until the turn passes', () => {
    setUpAppData();
    scriptDice([1, 2, 3, 4, 6]);
    store().start({ players: [you, cpu('normal')] });
    expect(store().aiStep()).toBe(false);
    store().roll();
    store().score('chance');
    let steps = 0;
    while (game().current === 1 && steps < 30) {
      expect(store().aiStep()).toBe(true);
      steps++;
    }
    expect(game().current).toBe(0);
    expect(steps).toBeGreaterThanOrEqual(2); // at least a roll and a score
    expect(Object.keys(game().players[1].card)).toHaveLength(1);
  });

  it('skipAiTurn plays exactly one computer turn, even with several computers in a row', () => {
    setUpAppData();
    scriptDice([6, 5, 4, 3, 2, 1]);
    store().start({ players: [you, cpu('easy', 'c1'), cpu('expert', 'c2')] });
    store().roll();
    store().score('chance');
    store().skipAiTurn();
    expect(game().current).toBe(2);
    expect(Object.keys(game().players[1].card)).toHaveLength(1);
    expect(game().players[2].card).toEqual({});
    store().skipAiTurn();
    expect(game().current).toBe(0);
    expect(game().round).toBe(2);
  });

  it('skipAiTurn does nothing on a human turn or without a game', () => {
    setUpAppData();
    store().skipAiTurn();
    expect(store().game).toBeNull();
    store().start({ players: [you] });
    const before = game();
    store().skipAiTurn();
    expect(game()).toBe(before);
  });

  it('an all-computer table plays itself to the end with every move legal', () => {
    setUpAppData();
    store().start({ players: [cpu('easy', 'a'), cpu('normal', 'b'), cpu('expert', 'c')], preset: 'scandinavian' });
    let guard = 0;
    while (game().status === 'playing' && guard++ < 2000) expect(store().aiStep()).toBe(true);
    expect(game().status).toBe('finished');
    expect(getAppData().gameLog[0].players.map((p) => p.kind)).toEqual(['ai', 'ai', 'ai']);
    expect(getAppData().gameLog[0].humanFaceCounts).toEqual([0, 0, 0, 0, 0, 0]);
    expect(getAppData().gameLog[0].aiFaceCounts.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(15 * 3 * 5);
  });
});

describe('finishing: log entry, stats, unlocks and the daily record', () => {
  function playOut(players: PlayerConfig[], preset: 'classic' | 'scandinavian' = 'classic') {
    const boxes = preset === 'classic' ? CLASSIC.boxes : SCANDINAVIAN.boxes;
    store().start({ players, preset });
    for (let turn = 0; turn < boxes.length * players.length; turn++) {
      if (game().players[game().current].kind === 'ai') {
        store().skipAiTurn();
        continue;
      }
      store().roll();
      const open = boxes.find((b) => game().players[game().current].card[b] === undefined)!;
      store().score(open);
    }
  }

  it('a 3-player game logs every player, the winners, and only human faces in the human tally', () => {
    setUpAppData();
    scriptDice([6, 6, 6, 6, 6]);
    playOut([you, mom, cpu('normal')]);
    expect(game().status).toBe('finished');
    const entry = getAppData().gameLog[0];
    expect(entry.players.map((p) => p.name)).toEqual(['You', 'Mom', 'Computer (normal)']);
    expect(entry.players[2].aiLevel).toBe('normal');
    // Everyone rolled sixes only. The people filled the pad top to bottom (Yatzy box only on turn 12,
    // so one joker on turn 13); the computer took the Yatzy box first and cashed every joker, so it wins alone.
    expect(entry.winnerIndexes).toEqual([2]);
    expect(entry.players[0].total).toBe(entry.players[1].total);
    expect(entry.players[2].total).toBeGreaterThan(entry.players[0].total);
    expect(entry.humanFaceCounts).toEqual([0, 0, 0, 0, 0, 13 * 5 * 2]);
    expect(entry.aiFaceCounts).toEqual([0, 0, 0, 0, 0, 13 * 5]);
    expect(entry.yatzys).toBe(4); // per person: the Yatzy box + one joker; computer Yatzys are not counted
    expect(entry.extraYatzys).toBe(2);
    expect(entry.upperBonusMade).toBe(false);
    expect(getAppData().stats.gamesCompleted).toBe(1);
  });

  it('newUnlocks is set only for the game that crosses the line, and cleared on dismiss', () => {
    setUpAppData();
    updateAppData((d) => ({ ...d, stats: { ...d.stats, gamesCompleted: 9 } }));
    scriptDice([1, 2, 3, 4, 5]);
    playOut([you]);
    expect(store().newUnlocks).toEqual(['amber']);
    expect(getAppData().unlocks.dice).toContain('amber');
    store().dismissFinished();
    expect(store().newUnlocks).toEqual([]);
    playOut([you]);
    expect(store().newUnlocks).toEqual([]);
  });

  it('a 7-day streak reached by finishing a daily unlocks Jade at that moment', () => {
    setUpAppData();
    updateAppData((d) => ({ ...d, daily: { ...d.daily, streak: 6, bestStreak: 6, lastCompleted: '2026-10-16' } }));
    store().startDaily('2026-10-17', you);
    for (const box of CLASSIC.boxes) {
      store().roll();
      store().score(box);
    }
    expect(getAppData().daily).toMatchObject({ streak: 7, bestStreak: 7 });
    expect(store().newUnlocks).toEqual(['jade']);
  });

  it('abandoning a game and starting another never counts the first', () => {
    setUpAppData();
    scriptDice([1, 2, 3, 4, 5]);
    store().start({ players: [you] });
    store().roll();
    store().score('chance');
    playOut([you], 'scandinavian');
    expect(getAppData().stats.gamesCompleted).toBe(1);
    expect(getAppData().gameLog.map((g) => g.preset)).toEqual(['scandinavian']);
  });

  it('hydrating a finished game keeps it until dismissed, and Home can still open its scorecard', () => {
    const kv = setUpAppData();
    scriptDice([2, 2, 2, 2, 2]);
    playOut([you]);
    useGameStore.setState({ game: null });
    setUpAppData(kv);
    store().hydrate();
    expect(game().status).toBe('finished');
    store().dismissFinished();
    expect(getAppData().inProgress).toBeNull();
  });
});

describe('rollSeq', () => {
  it('counts computer rolls too, so their dice tumble on screen', () => {
    setUpAppData();
    scriptDice([1, 1, 2, 2, 3]);
    store().start({ players: [you, cpu('normal')] });
    store().roll();
    store().score('chance');
    const before = store().rollSeq;
    store().skipAiTurn();
    expect(store().rollSeq).toBeGreaterThan(before);
  });

  it('is not persisted', () => {
    const kv = setUpAppData();
    scriptDice([1, 1, 2, 2, 3]);
    store().start({ players: [you] });
    store().roll();
    expect(JSON.stringify(kv.data.get('root'))).not.toContain('rollSeq');
  });
});

it('app data defaults are what a brand-new install sees', () => {
  const kv = memoryStore();
  initAppData(new Repository(kv));
  expect(getAppData()).toEqual(createDefaultData());
});
