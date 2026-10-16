import type { GameState } from '../engine/game';
import { PRESETS } from '../engine/rules/presets';
import { decide, type AiDecision, type Chooser } from './strategy';

export { decide, holdMask, type AiDecision, type AiView, type Chooser } from './strategy';

/** One visible step of a computer turn, so the table can animate it. */
export type AiStep = { type: 'roll' } | { type: 'toggleHold'; index: number } | { type: 'score'; box: import('../engine/rules/presets').BoxId };

let planned: { key: string; decision: AiDecision } | null = null;

/** The decision is made once per roll, so Easy's random pick can't change while its holds animate. */
function planFor(game: GameState, choose?: Chooser): AiDecision {
  const key = `${game.id}|${game.round}|${game.current}|${game.rollsUsed}|${game.dice.join('')}`;
  if (planned?.key !== key) {
    const player = game.players[game.current];
    const decision = decide(
      {
        preset: PRESETS[game.preset],
        card: player.card,
        extraYatzyCount: player.extraYatzyCount,
        forcedOrder: game.forcedOrder,
        dice: game.dice,
        rollsUsed: game.rollsUsed,
      },
      player.aiLevel ?? 'normal',
      choose,
    );
    planned = { key, decision };
  }
  return planned.decision;
}

/** Next step for the computer player whose turn it is, or null if it isn't a computer's turn. */
export function nextAiStep(game: GameState, choose?: Chooser): AiStep | null {
  const player = game.players[game.current];
  if (game.status !== 'playing' || player.kind !== 'ai') return null;
  if (game.rollsUsed === 0) return { type: 'roll' };
  const decision = planFor(game, choose);
  if (decision.type === 'score') return decision;
  const index = decision.held.findIndex((h, i) => h !== game.held[i]);
  return index === -1 ? { type: 'roll' } : { type: 'toggleHold', index };
}
