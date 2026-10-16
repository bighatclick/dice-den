/** AI strength benchmark, not part of `npm test`. Run with `npm run bench:ai` (BENCH_N sets the game count). */
import { createGame, gameReducer, playerTotal, rollAction, type AiLevel } from '../../engine/game';
import { createSeededRng } from '../../engine/rng';
import type { PresetId } from '../../engine/rules/presets';
import { nextAiStep } from '../index';

const N = Number(process.env.BENCH_N ?? 300);
it('h2h', () => {
  const out: string[] = [];
  const [a, b] = (process.env.H2H ?? 'expert,normal').split(',') as AiLevel[];
  for (const preset of ['classic', 'scandinavian'] as PresetId[]) {
    let winsA = 0, ties = 0;
    for (let i = 0; i < N; i++) {
      const rng = createSeededRng(`h${i}`);
      // Alternate seats so neither level always goes first.
      const levels = i % 2 ? [a, b] : [b, a];
      let g = createGame({ id: `h${i}`, preset, players: levels.map((l, j) => ({ id: `${j}`, name: l, kind: 'ai' as const, aiLevel: l, color: '' })) });
      while (g.status === 'playing') {
        const s = nextAiStep(g, () => 0)!;
        g = gameReducer(g, s.type === 'roll' ? rollAction(g, rng) : s);
      }
      const ia = levels.indexOf(a), ib = 1 - ia;
      const d = playerTotal(g, ia) - playerTotal(g, ib);
      if (d > 0) winsA++; else if (d === 0) ties++;
    }
    out.push(`${preset} ${a} beats ${b}: ${((winsA / N) * 100).toFixed(1)}% (ties ${ties})`);
  }
  console.log(out.join('\n'));
});
