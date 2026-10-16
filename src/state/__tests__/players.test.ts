import type { GameLogEntry } from '../../data/schema';
import { buildPlayers, COMPUTER_COLOR, lastTable, SEAT_COLORS } from '../players';

const names = { you: 'You', computer: (l: string) => `Computer (${l})`, seat: (n: number) => `Player ${n}` };
const entry = (players: GameLogEntry['players'], mode: GameLogEntry['mode'] = 'normal'): GameLogEntry => ({
  id: 'x',
  finishedAt: 'x',
  mode,
  preset: 'classic',
  players,
  winnerIndexes: [0],
  humanFaceCounts: [],
  aiFaceCounts: [],
  extraYatzys: 0,
  upperBonusMade: false,
});
const you = { name: 'You', kind: 'human' as const, total: 1 };
const cpu = (aiLevel: 'easy' | 'expert') => ({ name: 'C', kind: 'ai' as const, aiLevel, total: 1 });

describe('lastTable', () => {
  it('defaults to solo', () => {
    expect(lastTable([])).toEqual({ opponents: 'solo', aiLevel: 'normal', seats: [] });
  });

  it('recognises solo, vs computer and pass and play, ignoring daily games', () => {
    expect(lastTable([entry([you, cpu('easy')]), entry([you])]).opponents).toBe('solo');
    expect(lastTable([entry([you, cpu('expert')]), entry([you], 'daily')])).toMatchObject({ opponents: 'computer', aiLevel: 'expert' });
    expect(lastTable([entry([you, { ...you, name: 'Dad' }])]).seats.map((s) => s.name)).toEqual(['You', 'Dad']);
    expect(lastTable([entry([you, cpu('easy'), cpu('expert')])]).opponents).toBe('pass');
  });
});

describe('buildPlayers', () => {
  it('builds each kind of table with seat colours', () => {
    expect(buildPlayers({ opponents: 'solo', aiLevel: 'normal', seats: [] }, names)).toEqual([
      { id: 'p1', name: 'You', kind: 'human', color: SEAT_COLORS[0] },
    ]);
    expect(buildPlayers({ opponents: 'computer', aiLevel: 'easy', seats: [] }, names)[1]).toEqual({
      id: 'p2',
      name: 'Computer (easy)',
      kind: 'ai',
      aiLevel: 'easy',
      color: COMPUTER_COLOR,
    });
    const seats = [
      { kind: 'human' as const, name: '  Mom ', aiLevel: 'normal' as const },
      { kind: 'human' as const, name: '', aiLevel: 'normal' as const },
      { kind: 'ai' as const, name: '', aiLevel: 'expert' as const },
    ];
    expect(buildPlayers({ opponents: 'pass', aiLevel: 'normal', seats }, names).map((p) => [p.name, p.color])).toEqual([
      ['Mom', SEAT_COLORS[0]],
      ['Player 2', SEAT_COLORS[1]],
      ['Computer (expert)', SEAT_COLORS[2]],
    ]);
  });
});
