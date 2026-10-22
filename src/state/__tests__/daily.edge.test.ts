import { createDefaultData, type DailyState, type GameLogEntry } from '../../data/schema';
import { addDays, completeDaily, currentStreak, dailyDateOf, dailyGameId, dailyHistory, formatDateKey, isoWeek } from '../daily';
import { computeStats, facePercents } from '../stats';
import { previousBest, toLogEntry, winnerIndexes } from '../gameLog';
import { createGame, gameReducer, type GameState } from '../../engine/game';
import { buildPlayers, lastTable, SEAT_COLORS } from '../players';

const fresh = (): DailyState => createDefaultData().daily;

describe('daily ids', () => {
  it.each([
    ['daily-2026-10-17', '2026-10-17'],
    ['daily-2026-10-17-r1', '2026-10-17'],
    ['daily-2026-10-17-r12', '2026-10-17'],
    ['daily-2026-10-17-rx', null],
    ['daily-2026-10-17-', null],
    ['daily-2026-1-7', null],
    ['gdaily-2026-10-17', null],
    ['', null],
  ])('%s → %p', (id, date) => {
    expect(dailyDateOf(id)).toBe(date);
  });

  it('replay 0 and a negative replay mean the plain id', () => {
    expect(dailyGameId('2026-10-17', 0)).toBe('daily-2026-10-17');
    expect(dailyGameId('2026-10-17', -1)).toBe('daily-2026-10-17');
  });
});

describe('date arithmetic', () => {
  it.each([
    ['2024-02-28', 1, '2024-02-29'],
    ['2024-02-29', 1, '2024-03-01'],
    ['2023-02-28', 1, '2023-03-01'],
    ['2026-01-01', -1, '2025-12-31'],
    ['2026-10-17', 0, '2026-10-17'],
    ['2026-10-17', 365, '2027-10-17'],
    ['2026-03-29', 1, '2026-03-30'], // around European DST: UTC maths, no 23-hour day
  ])('addDays(%s, %i) = %s', (date, n, expected) => {
    expect(addDays(date, n)).toBe(expected);
  });

  it.each([
    ['2026-12-28', '2026-W53'],
    ['2026-12-31', '2026-W53'],
    ['2027-01-03', '2026-W53'],
    ['2027-01-04', '2027-W01'],
    ['2021-01-01', '2020-W53'],
    ['2024-12-29', '2024-W52'],
    ['2024-12-30', '2025-W01'],
    ['2026-10-19', '2026-W43'],
    ['2026-10-18', '2026-W42'],
  ])('isoWeek(%s) = %s (ISO weeks start on Monday)', (date, week) => {
    expect(isoWeek(date)).toBe(week);
  });
});

describe('streak edge cases', () => {
  it('the first ever completion starts a streak of 1', () => {
    const d = completeDaily(fresh(), '2026-10-17', 100);
    expect(d).toMatchObject({ streak: 1, bestStreak: 1, lastCompleted: '2026-10-17', freezeUsedWeek: null });
  });

  it('completing a date earlier than the last completed one restarts the streak (clock set back)', () => {
    let d = completeDaily(fresh(), '2026-10-17', 100);
    d = completeDaily(d, '2026-10-10', 90);
    expect(d.streak).toBe(1);
    expect(d.lastCompleted).toBe('2026-10-10');
    expect(d.results).toEqual({ '2026-10-17': 100, '2026-10-10': 90 });
  });

  it('a freeze bridges a gap of exactly 2 days, never 3', () => {
    let d = completeDaily(fresh(), '2026-10-05', 1); // Mon W41
    d = completeDaily(d, '2026-10-08', 1); // Thu, 3-day gap
    expect(d.streak).toBe(1);
    d = completeDaily(d, '2026-10-10', 1); // Sat, 2-day gap, freeze
    expect(d).toMatchObject({ streak: 2, freezeUsedWeek: '2026-W41' });
  });

  it('the freeze week is the week of the day being completed, not of the missed day', () => {
    let d = completeDaily(fresh(), '2026-10-10', 1); // Sat W41
    d = completeDaily(d, '2026-10-12', 1); // Mon W42: missed Sunday (W41)
    expect(d.freezeUsedWeek).toBe('2026-W42');
    // The next W42 miss cannot be bridged.
    d = completeDaily(d, '2026-10-14', 1);
    expect(d.streak).toBe(1);
  });

  it('a freeze used in an earlier week is available again', () => {
    let d = completeDaily(fresh(), '2026-10-05', 1);
    d = completeDaily(d, '2026-10-07', 1); // freeze W41
    d = completeDaily(d, '2026-10-08', 1);
    d = completeDaily(d, '2026-10-09', 1);
    d = completeDaily(d, '2026-10-11', 1); // Sun, still W41: no freeze
    expect(d.streak).toBe(1);
    d = completeDaily(d, '2026-10-13', 1); // Tue W42: freeze again
    expect(d).toMatchObject({ streak: 2, freezeUsedWeek: '2026-W42' });
  });

  it('bestStreak never decreases and tracks the maximum reached', () => {
    let d = fresh();
    for (let i = 0; i < 10; i++) d = completeDaily(d, addDays('2026-01-01', i), i);
    expect(d.bestStreak).toBe(10);
    d = completeDaily(d, '2026-03-01', 0);
    expect(d).toMatchObject({ streak: 1, bestStreak: 10 });
    for (let i = 1; i < 5; i++) d = completeDaily(d, addDays('2026-03-01', i), 0);
    expect(d.bestStreak).toBe(10);
  });

  it('a score of 0 still locks the day', () => {
    const d = completeDaily(fresh(), '2026-10-17', 0);
    expect(d.results['2026-10-17']).toBe(0);
    expect(completeDaily(d, '2026-10-17', 300).results['2026-10-17']).toBe(0);
  });

  it('completeDaily never mutates its input', () => {
    const before = fresh();
    const snapshot = JSON.stringify(before);
    completeDaily(before, '2026-10-17', 1);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('currentStreak on the day after a freeze-bridged day is still alive', () => {
    let d = completeDaily(fresh(), '2026-10-12', 1);
    d = completeDaily(d, '2026-10-14', 1); // freeze used W42
    expect(currentStreak(d, '2026-10-15')).toBe(2);
    expect(currentStreak(d, '2026-10-16')).toBe(0); // 2-day gap, freeze already used this week
  });

  it('currentStreak for a date before lastCompleted (clock moved back) is 0', () => {
    const d = completeDaily(fresh(), '2026-10-17', 1);
    expect(currentStreak(d, '2026-10-01')).toBe(0);
  });
});

describe('history and formatting', () => {
  it('defaults to 28 days ending today, oldest first', () => {
    const h = dailyHistory(fresh(), '2026-10-17');
    expect(h).toHaveLength(28);
    expect(h[0].date).toBe('2026-09-20');
    expect(h[27].date).toBe('2026-10-17');
    expect(h.every((d) => d.score === null)).toBe(true);
  });

  it('formatDateKey renders a real calendar day in the device language', () => {
    const text = formatDateKey('2026-10-17');
    expect(text).toMatch(/17/);
    expect(formatDateKey('2026-02-29', { month: 'numeric', day: 'numeric' })).toMatch(/3.*1|1.*3/); // not a real date: rolls to 1 March
  });
});

describe('computeStats edge cases', () => {
  const entry = (over: Partial<GameLogEntry>): GameLogEntry => ({
    id: 'x',
    finishedAt: 'x',
    mode: 'normal',
    preset: 'classic',
    players: [{ name: 'You', kind: 'human', total: 200 }],
    winnerIndexes: [0],
    humanFaceCounts: [0, 0, 0, 0, 0, 0],
    aiFaceCounts: [0, 0, 0, 0, 0, 0],
    extraYatzys: 0,
    upperBonusMade: false,
    ...over,
  });

  it('a lost game against the computer counts as played, not won; a tie is not a win', () => {
    const log = [
      entry({ players: [{ name: 'You', kind: 'human', total: 100 }, { name: 'C', kind: 'ai', aiLevel: 'easy', total: 200 }], winnerIndexes: [1] }),
      entry({ players: [{ name: 'You', kind: 'human', total: 100 }, { name: 'C', kind: 'ai', aiLevel: 'easy', total: 100 }], winnerIndexes: [0, 1] }),
      entry({ players: [{ name: 'You', kind: 'human', total: 300 }, { name: 'C', kind: 'ai', aiLevel: 'easy', total: 100 }], winnerIndexes: [0] }),
    ];
    expect(computeStats(log).vs.easy).toEqual({ played: 3, won: 1 });
  });

  it('a table with one person and two computers is neither a vs record nor pass-and-play, but counts for average', () => {
    const log = [
      entry({
        players: [
          { name: 'You', kind: 'human', total: 150 },
          { name: 'A', kind: 'ai', aiLevel: 'easy', total: 1 },
          { name: 'B', kind: 'ai', aiLevel: 'expert', total: 1 },
        ],
      }),
    ];
    const s = computeStats(log);
    expect(s.vs.easy.played + s.vs.expert.played).toBe(0);
    expect(s.passAndPlay).toBe(0);
    expect(s.average).toBe(150);
  });

  it('an all-computer game contributes dice but no high score or average', () => {
    const log = [entry({ players: [{ name: 'A', kind: 'ai', aiLevel: 'expert', total: 400 }], aiFaceCounts: [1, 2, 3, 4, 5, 6], winnerIndexes: [0] })];
    const s = computeStats(log);
    expect(s.highScore).toBeNull();
    expect(s.average).toBeNull();
    expect(s.aiFaces).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('old entries without yatzys fall back to extraYatzys; short face arrays are tolerated', () => {
    const log = [entry({ extraYatzys: 2, humanFaceCounts: [1, 2] }), entry({ extraYatzys: 9, yatzys: 1 })];
    const s = computeStats(log);
    expect(s.yatzys).toBe(3);
    expect(s.humanFaces).toEqual([1, 2, 0, 0, 0, 0]);
  });

  it('the average is rounded to the nearest point and the bonus rate is a fraction of own games', () => {
    const log = [entry({ players: [{ name: 'You', kind: 'human', total: 101 }], upperBonusMade: true }), entry({ players: [{ name: 'You', kind: 'human', total: 102 }] }), entry({ players: [{ name: 'You', kind: 'human', total: 102 }] })];
    const s = computeStats(log);
    expect(s.average).toBe(102);
    expect(s.bonusRate).toBeCloseTo(1 / 3);
  });

  it('facePercents sums to 100 (within rounding) for any non-empty tally', () => {
    const p = facePercents([7, 11, 13, 17, 19, 23]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9);
  });
});

describe('game log helpers', () => {
  const human = (id: string, name: string) => ({ id, name, kind: 'human' as const, color: '#000' });

  it('winnerIndexes picks the highest total(s) including the extra Yatzy bonus', () => {
    let g: GameState = createGame({ id: 'w', preset: 'classic', players: [human('a', 'A'), human('b', 'B')] });
    g = gameReducer(g, { type: 'roll', faces: [6, 6, 6, 6, 6] });
    g = gameReducer(g, { type: 'score', box: 'yatzy' }); // A 50
    g = gameReducer(g, { type: 'roll', faces: [6, 6, 6, 6, 5] });
    g = gameReducer(g, { type: 'score', box: 'chance' }); // B 29
    g = gameReducer(g, { type: 'roll', faces: [6, 6, 6, 6, 6] });
    g = gameReducer(g, { type: 'score', box: 'sixes' }); // A 50+30+100
    expect(winnerIndexes(g)).toEqual([0]);
    const entry = toLogEntry(g, '2026-10-17T00:00:00Z');
    expect(entry.players[0].total).toBe(180);
    expect(entry.yatzys).toBe(2);
    expect(entry.extraYatzys).toBe(1);
  });

  it('toLogEntry records the upper bonus only for people', () => {
    let g: GameState = createGame({ id: 'b', preset: 'classic', players: [{ id: 'c', name: 'C', kind: 'ai', aiLevel: 'easy', color: '#000' }] });
    for (const [box, faces] of [['ones', [1, 1, 1, 1, 1]], ['twos', [2, 2, 2, 2, 2]], ['threes', [3, 3, 3, 3, 3]], ['fours', [4, 4, 4, 4, 4]], ['fives', [5, 5, 5, 5, 5]], ['sixes', [6, 6, 6, 6, 6]]] as const) {
      g = gameReducer(g, { type: 'roll', faces: [...faces] });
      g = gameReducer(g, { type: 'score', box });
    }
    expect(toLogEntry(g, 'x').upperBonusMade).toBe(false);
  });

  it('previousBest ignores computers, other presets and the game itself', () => {
    const g = createGame({ id: 'now', preset: 'scandinavian', players: [human('a', 'A')] });
    const base: GameLogEntry = { id: 'old', finishedAt: 'x', mode: 'normal', preset: 'scandinavian', players: [], winnerIndexes: [], humanFaceCounts: [], aiFaceCounts: [], extraYatzys: 0, upperBonusMade: false };
    const log: GameLogEntry[] = [
      { ...base, players: [{ name: 'A', kind: 'human', total: 150 }, { name: 'C', kind: 'ai', aiLevel: 'expert', total: 999 }] },
      { ...base, id: 'c', preset: 'classic', players: [{ name: 'A', kind: 'human', total: 500 }] },
      { ...base, id: 'now', players: [{ name: 'A', kind: 'human', total: 600 }] },
      { ...base, id: 'daily', mode: 'daily', players: [{ name: 'A', kind: 'human', total: 160 }] },
    ];
    expect(previousBest(log, g)).toBe(160);
  });
});

describe('players: seats and the remembered table', () => {
  const names = { you: 'You', computer: (l: string) => `Computer (${l})`, seat: (n: number) => `Player ${n}` };

  it('pass-and-play caps at 6 seats and reuses seat colours by position', () => {
    const seats = Array.from({ length: 8 }, (_, i) => ({ kind: 'human' as const, name: `P${i}`, aiLevel: 'normal' as const }));
    const players = buildPlayers({ opponents: 'pass', aiLevel: 'normal', seats }, names);
    expect(players).toHaveLength(6);
    expect(players.map((p) => p.color)).toEqual([...SEAT_COLORS]);
    expect(players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  });

  it('whitespace-only names fall back to the default seat name', () => {
    const players = buildPlayers({ opponents: 'pass', aiLevel: 'normal', seats: [{ kind: 'human', name: '   ', aiLevel: 'normal' }, { kind: 'human', name: '\t', aiLevel: 'normal' }] }, names);
    expect(players.map((p) => p.name)).toEqual(['Player 1', 'Player 2']);
  });

  it('a solo table ignores whatever seats are in the draft', () => {
    const players = buildPlayers({ opponents: 'solo', aiLevel: 'expert', seats: [{ kind: 'ai', name: '', aiLevel: 'easy' }] }, names);
    expect(players).toEqual([{ id: 'p1', name: 'You', kind: 'human', color: SEAT_COLORS[0] }]);
  });

  it('lastTable: the most recent normal game wins over older ones', () => {
    const base: GameLogEntry = { id: 'x', finishedAt: 'x', mode: 'normal', preset: 'classic', players: [], winnerIndexes: [], humanFaceCounts: [], aiFaceCounts: [], extraYatzys: 0, upperBonusMade: false };
    const log = [
      { ...base, players: [{ name: 'You', kind: 'human' as const, total: 1 }, { name: 'C', kind: 'ai' as const, aiLevel: 'expert' as const, total: 1 }] },
      { ...base, players: [{ name: 'Gran', kind: 'human' as const, total: 1 }, { name: 'C', kind: 'ai' as const, aiLevel: 'easy' as const, total: 1 }, { name: 'Pa', kind: 'human' as const, total: 1 }] },
    ];
    const t = lastTable(log);
    expect(t.opponents).toBe('pass');
    expect(t.seats.map((s) => [s.kind, s.name, s.aiLevel])).toEqual([
      ['human', 'Gran', 'normal'],
      ['ai', '', 'easy'],
      ['human', 'Pa', 'normal'],
    ]);
  });

  it('lastTable: a computer-only log entry is treated as pass-and-play with computer seats', () => {
    const base: GameLogEntry = { id: 'x', finishedAt: 'x', mode: 'normal', preset: 'classic', players: [], winnerIndexes: [], humanFaceCounts: [], aiFaceCounts: [], extraYatzys: 0, upperBonusMade: false };
    const t = lastTable([{ ...base, players: [{ name: 'A', kind: 'ai', aiLevel: 'normal', total: 1 }, { name: 'B', kind: 'ai', aiLevel: 'expert', total: 1 }] }]);
    expect(t.opponents).toBe('pass');
    expect(t.seats.every((s) => s.kind === 'ai')).toBe(true);
  });
});
