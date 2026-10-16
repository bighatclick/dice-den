/** AI strength benchmark, not part of `npm test`. Run with `npm run bench:ai` (BENCH_N sets the game count). */
import { createGame, gameReducer, playerTotal, rollAction, type AiLevel } from '../../engine/game';
import { createSeededRng } from '../../engine/rng';
import type { PresetId } from '../../engine/rules/presets';
import { nextAiStep } from '../index';

const N = Number(process.env.BENCH_N ?? 300);
function play(level: AiLevel, seed: string, preset: PresetId) {
  const rng = createSeededRng(seed);
  let r = 0;
  const choose = (n: number) => Math.floor((Math.sin(++r * 99.7) * 0.5 + 0.5) * n);
  let g = createGame({ id: seed, preset, players: [{ id: 'c', name: 'c', kind: 'ai', aiLevel: level, color: '' }] });
  while (g.status === 'playing') {
    const s = nextAiStep(g, choose)!;
    g = gameReducer(g, s.type === 'roll' ? rollAction(g, rng) : s);
  }
  return playerTotal(g, 0);
}
it('bench', () => {
  const out: string[] = [];
  const levels = (process.env.BENCH_LEVELS ?? 'easy,normal,expert').split(',') as AiLevel[];
  for (const preset of ['classic', 'scandinavian'] as PresetId[])
    for (const level of levels) {
      const t = Date.now();
      const s: number[] = [];
      for (let i = 0; i < N; i++) s.push(play(level, `b${i}`, preset));
      const mean = s.reduce((a, b) => a + b, 0) / N;
      out.push(`${preset} ${level} avg=${mean.toFixed(1)} ms/game=${((Date.now() - t) / N).toFixed(0)}`);
    }
  console.log(out.join('\n'));
});
