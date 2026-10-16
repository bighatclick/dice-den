import { createDefaultData, type DailyState, type GameLogEntry } from '../../data/schema';
import { createDailyRng } from '../../engine/rng';
import { CLASSIC } from '../../engine/rules/presets';
import { setUpAppData } from '../../testing/appData';
import { getAppData } from '../appData';
import { addDays, completeDaily, currentStreak, dailyDateOf, dailyGameId, dailyHistory, isoWeek } from '../daily';
import { useGameStore } from '../gameStore';
import { computeStats, facePercents } from '../stats';

const fresh = (): DailyState => createDefaultData().daily;
const you = { id: 'p1', name: 'You', kind: 'human' as const, color: '#000' };

describe('daily dates', () => {
  it('builds and reads game ids', () => {
    expect(dailyGameId('2026-10-17')).toBe('daily-2026-10-17');
    expect(dailyGameId('2026-10-17', 2)).toBe('daily-2026-10-17-r2');
    expect(dailyDateOf('daily-2026-10-17-r2')).toBe('2026-10-17');
    expect(dailyDateOf('g123')).toBeNull();
  });

  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it.each([
    ['2026-10-17', '2026-W42'],
    ['2026-01-01', '2026-W01'],
    ['2027-01-01', '2026-W53'],
    ['2024-12-30', '2025-W01'],
  ])('isoWeek(%s) = %s', (date, week) => expect(isoWeek(date)).toBe(week));
});

describe('streaks (specs.md F6)', () => {
  it('counts consecutive days and keeps the best', () => {
    let d = completeDaily(fresh(), '2026-10-12', 200);
    d = completeDaily(d, '2026-10-13', 210);
    d = completeDaily(d, '2026-10-14', 220);
    expect(d).toMatchObject({ streak: 3, bestStreak: 3, lastCompleted: '2026-10-14' });
    d = completeDaily(d, '2026-10-20', 230);
    expect(d).toMatchObject({ streak: 1, bestStreak: 3 });
  });

  it('locks the first result of a day; replays change nothing', () => {
    const d = completeDaily(fresh(), '2026-10-12', 200);
    expect(completeDaily(d, '2026-10-12', 300)).toBe(d);
  });

  it('bridges one missed day per week with the free freeze', () => {
    let d = completeDaily(fresh(), '2026-10-12', 1); // Mon
    d = completeDaily(d, '2026-10-14', 1); // missed Tue
    expect(d).toMatchObject({ streak: 2, freezeUsedWeek: '2026-W42' });
    d = completeDaily(d, '2026-10-16', 1); // missed Thu, same week: freeze used
    expect(d.streak).toBe(1);
    d = completeDaily(d, '2026-10-18', 1); // Sun, still W42
    expect(d.streak).toBe(1);
    d = completeDaily(d, '2026-10-20', 1); // W43: a new freeze
    expect(d.streak).toBe(2);
  });

  it('shows the streak while it is still alive', () => {
    const d = completeDaily(completeDaily(fresh(), '2026-10-12', 1), '2026-10-13', 1);
    expect(currentStreak(d, '2026-10-13')).toBe(2);
    expect(currentStreak(d, '2026-10-14')).toBe(2);
    expect(currentStreak(d, '2026-10-15')).toBe(2); // freeze available
    expect(currentStreak(d, '2026-10-16')).toBe(0);
    expect(currentStreak({ ...d, freezeUsedWeek: '2026-W42' }, '2026-10-15')).toBe(0);
    expect(currentStreak(fresh(), '2026-10-15')).toBe(0);
  });

  it('lists recent days for the calendar', () => {
    const d = completeDaily(fresh(), '2026-10-15', 244);
    const h = dailyHistory(d, '2026-10-17', 3);
    expect(h).toEqual([
      { date: '2026-10-15', score: 244 },
      { date: '2026-10-16', score: null },
      { date: '2026-10-17', score: null },
    ]);
  });
});

describe('daily games in the store', () => {
  beforeEach(() => {
    setUpAppData();
    useGameStore.setState({ game: null, rollSeq: 0 });
  });

  it("rolls the date's seeded sequence, even after a relaunch", () => {
    const expected = createDailyRng('2026-10-17');
    const faces = Array.from({ length: 10 }, () => expected.nextFace());
    const { startDaily, roll, toggleHold } = useGameStore.getState();
    startDaily('2026-10-17', you);
    roll();
    expect(useGameStore.getState().game!.dice).toEqual(faces.slice(0, 5));
    toggleHold(0);
    toggleHold(1);
    // Simulate a relaunch: forget the in-memory sequence position.
    useGameStore.setState({ game: JSON.parse(JSON.stringify(useGameStore.getState().game)) });
    roll();
    expect(useGameStore.getState().game!.dice).toEqual([...faces.slice(0, 2), ...faces.slice(5, 8)]);
  });

  it('records the result and streak once, and replays use the same dice', () => {
    const play = (replay: number) => {
      const { startDaily, roll, score } = useGameStore.getState();
      startDaily('2026-10-17', you, replay);
      for (const box of CLASSIC.boxes) {
        roll();
        score(box);
      }
      return useGameStore.getState().game!;
    };
    const first = play(0);
    const total = getAppData().daily.results['2026-10-17'];
    expect(getAppData().daily).toMatchObject({ streak: 1, lastCompleted: '2026-10-17' });
    const replay = play(1);
    expect(replay.players[0].card).toEqual(first.players[0].card);
    expect(getAppData().daily.results['2026-10-17']).toBe(total);
    expect(getAppData().gameLog.map((g) => g.mode)).toEqual(['daily', 'daily']);
  });
});

describe('computeStats', () => {
  const entry = (over: Partial<GameLogEntry>): GameLogEntry => ({
    id: 'x',
    finishedAt: 'x',
    mode: 'normal',
    preset: 'classic',
    players: [{ name: 'You', kind: 'human', total: 200 }],
    winnerIndexes: [0],
    humanFaceCounts: [1, 1, 1, 1, 1, 1],
    aiFaceCounts: [0, 0, 0, 0, 0, 0],
    extraYatzys: 0,
    upperBonusMade: false,
    ...over,
  });
  const log: GameLogEntry[] = [
    entry({ players: [{ name: 'You', kind: 'human', total: 250 }], upperBonusMade: true, yatzys: 2 }),
    entry({
      players: [
        { name: 'You', kind: 'human', total: 200 },
        { name: 'C', kind: 'ai', aiLevel: 'expert', total: 180 },
      ],
      aiFaceCounts: [2, 2, 2, 2, 2, 2],
    }),
    entry({
      players: [
        { name: 'You', kind: 'human', total: 150 },
        { name: 'C', kind: 'ai', aiLevel: 'expert', total: 150 },
      ],
      winnerIndexes: [0, 1],
    }),
    entry({
      preset: 'scandinavian',
      players: [
        { name: 'Mom', kind: 'human', total: 300 },
        { name: 'Dad', kind: 'human', total: 100 },
      ],
      extraYatzys: 1,
    }),
    entry({ mode: 'daily', players: [{ name: 'You', kind: 'human', total: 100 }] }),
  ];

  it('summarises all games', () => {
    const s = computeStats(log);
    expect(s).toMatchObject({ games: 5, highScore: 300, average: 175, yatzys: 3, passAndPlay: 1, daily: 1 });
    expect(s.bonusRate).toBeCloseTo(0.25);
    expect(s.vs.expert).toEqual({ played: 2, won: 1 });
    expect(s.humanFaces).toEqual([5, 5, 5, 5, 5, 5]);
    expect(s.aiFaces).toEqual([2, 2, 2, 2, 2, 2]);
  });

  it('filters by preset and handles an empty log', () => {
    expect(computeStats(log, 'scandinavian')).toMatchObject({ games: 1, average: null, bonusRate: null, highScore: 300 });
    expect(computeStats([])).toMatchObject({ games: 0, highScore: null });
  });

  it('turns counts into percentages', () => {
    expect(facePercents([1, 1, 2, 0, 0, 0])).toEqual([25, 25, 50, 0, 0, 0]);
    expect(facePercents([0, 0, 0, 0, 0, 0])).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
