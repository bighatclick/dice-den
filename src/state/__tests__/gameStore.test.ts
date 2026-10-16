import { CLASSIC } from '../../engine/rules/presets';
import { setUpAppData, scriptDice } from '../../testing/appData';
import { getAppData } from '../appData';
import { previousBest, toLogEntry, winnerIndexes } from '../gameLog';
import { useGameStore } from '../gameStore';
import { setGameRng } from '../rng';

const you = { id: 'p1', name: 'You', kind: 'human' as const, color: '#C77D4E' };
const cpu = { id: 'p2', name: 'Computer (Normal)', kind: 'ai' as const, aiLevel: 'normal' as const, color: '#3D525E' };
const store = () => useGameStore.getState();

beforeEach(() => {
  useGameStore.setState({ game: null, rollSeq: 0 });
  setGameRng(null);
});

describe('autosave (specs.md F2)', () => {
  it('writes the game after every roll, hold and score, and a relaunch restores it exactly', () => {
    const kv = setUpAppData();
    scriptDice([6, 6, 6, 2, 3]);
    store().start({ players: [you] });
    const saved = () => JSON.parse(kv.data.get('root')!).inProgress;

    store().roll();
    expect(saved().dice).toEqual([6, 6, 6, 2, 3]);
    store().toggleHold(0);
    expect(saved().held).toEqual([true, false, false, false, false]);
    store().score('sixes');
    expect(saved().players[0].card).toEqual({ sixes: 18 });

    // "Kill" the app: a new repository over the same storage, then hydrate.
    const before = store().game;
    useGameStore.setState({ game: null });
    setUpAppData(kv);
    store().hydrate();
    expect(store().game).toEqual(before);
  });

  it('uses the preset and order from settings unless the game says otherwise', () => {
    setUpAppData();
    expect(store().start({ players: [you] }).preset).toBe('classic');
    expect(store().start({ players: [you], preset: 'scandinavian', forcedOrder: true })).toMatchObject({
      preset: 'scandinavian',
      forcedOrder: true,
    });
  });

  it('ignores actions with no game and invalid moves', () => {
    setUpAppData();
    store().roll();
    store().score('ones');
    expect(store().game).toBeNull();
    store().start({ players: [you] });
    const game = store().game;
    store().toggleHold(0); // nothing rolled yet
    store().undo();
    expect(store().game).toBe(game);
  });

  it('bumps rollSeq only on rolls', () => {
    setUpAppData();
    scriptDice([1, 2, 3, 4, 5]);
    store().start({ players: [you] });
    store().roll();
    store().toggleHold(1);
    expect(store().rollSeq).toBe(1);
  });

  it('stops rolling after the third roll', () => {
    setUpAppData();
    scriptDice([1, 2, 3, 4, 5]);
    store().start({ players: [you] });
    store().roll();
    store().roll();
    store().roll();
    store().roll();
    expect(store().game?.rollsUsed).toBe(3);
    expect(store().rollSeq).toBe(3);
  });
});

describe('finishing a game', () => {
  function playToEnd() {
    setUpAppData();
    scriptDice([5, 5, 5, 5, 5]);
    store().start({ players: [you] });
    for (const box of CLASSIC.boxes) {
      store().roll();
      store().score(box);
    }
  }

  it('logs the game once, counts it and keeps it until the final scorecard is left', () => {
    playToEnd();
    const data = getAppData();
    expect(store().game?.status).toBe('finished');
    expect(data.gameLog).toHaveLength(1);
    expect(data.stats.gamesCompleted).toBe(1);
    expect(data.inProgress?.status).toBe('finished');
    expect(data.gameLog[0].humanFaceCounts).toEqual([0, 0, 0, 0, 13 * 5, 0]);

    store().undo(); // cannot reopen a logged game
    expect(store().game?.status).toBe('finished');

    store().dismissFinished();
    expect(store().game).toBeNull();
    expect(getAppData().inProgress).toBeNull();
    store().dismissFinished();
    expect(getAppData().gameLog).toHaveLength(1);
  });

  it('does not dismiss a game still being played', () => {
    setUpAppData();
    store().start({ players: [you] });
    store().dismissFinished();
    expect(store().game).not.toBeNull();
  });
});

describe('game log helpers', () => {
  it('finds every winner on a tie and the best earlier score per preset', () => {
    setUpAppData();
    const game = store().start({ players: [you, cpu] });
    expect(winnerIndexes(game)).toEqual([0, 1]);

    const entry = toLogEntry(game, '2026-10-16T00:00:00Z');
    expect(entry).toMatchObject({ preset: 'classic', winnerIndexes: [0, 1], upperBonusMade: false, extraYatzys: 0 });
    expect(entry.players[1]).toEqual({ name: cpu.name, kind: 'ai', aiLevel: 'normal', total: 0 });
    expect(entry.players[0]).not.toHaveProperty('aiLevel');

    const human = (total: number) => ({ name: 'You', kind: 'human' as const, total });
    const log = [
      { ...entry, id: 'old1', players: [human(180)] },
      { ...entry, id: 'old2', players: [human(240), { name: 'C', kind: 'ai' as const, total: 300 }] },
      { ...entry, id: 'scandi', preset: 'scandinavian' as const, players: [human(400)] },
      { ...entry, players: [human(999)] }, // this game itself
    ];
    expect(previousBest(log, game)).toBe(240);
    expect(previousBest([], game)).toBeNull();
  });

  it('counts faces from games saved before the tally existed as zero', () => {
    setUpAppData();
    const { faceTally: _tally, ...old } = store().start({ players: [you] });
    expect(toLogEntry(old, 'x').humanFaceCounts).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

it('refuses to read app data before it is loaded', () => {
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresh = require('../appData') as typeof import('../appData');
    expect(() => fresh.getAppData()).toThrow(/initAppData/);
  });
});
