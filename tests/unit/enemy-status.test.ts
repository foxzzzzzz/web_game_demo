import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import {
  applyEnemyResolvedEffects,
  createInitialGameState,
  createRun,
  selectSubtype,
  tickEnemyStatuses,
  unlockSubtype,
} from '../../src/domain';

describe('enemy status domain model', () => {
  it('applies resolved status effects by target ID, refreshes duration, and caps stacks', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'venom', 'venom-neuro');
    const effect = { type: 'status' as const, target: 'target' as const, targetIds: ['enemy-a'], statusId: 'paralysis', stacks: 6 };
    state = applyEnemyResolvedEffects(state, gameConfig, 'enemy-a', false, [effect]);
    state = tickEnemyStatuses(state, 2000);
    state = applyEnemyResolvedEffects(state, gameConfig, 'enemy-a', false, [effect]);

    expect(state.enemyStatuses['enemy-a'].statuses.find((status) => status.statusId === 'paralysis')).toEqual({ statusId: 'paralysis', stacks: 10, remainingMs: 6000 });
  });

  it('creates a threshold hard-control at reduced duration for large targets and removes expired statuses', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'venom', 'venom-neuro');
    state = applyEnemyResolvedEffects(state, gameConfig, 'elite-a', true, [{ type: 'status', target: 'target', targetIds: ['elite-a'], statusId: 'paralysis', stacks: 10 }]);

    expect(state.enemyStatuses['elite-a'].statuses.find((status) => status.statusId === 'stun')?.remainingMs).toBe(1000);
    state = tickEnemyStatuses(state, 6000);
    expect(state.enemyStatuses['elite-a']).toBeUndefined();
  });

  it('does not clear already-applied debuffs when the venom subtype changes', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'venom', 'venom-neuro');
    state = applyEnemyResolvedEffects(state, gameConfig, 'enemy-a', false, [{ type: 'status', target: 'target', targetIds: ['enemy-a'], statusId: 'paralysis', stacks: 6 }]);
    state = unlockSubtype(state, gameConfig, 'venom-neuro-beta');
    state = selectSubtype(state, gameConfig, 'venom-neuro-beta');

    expect(state.activeSubtypeId).toBe('venom-neuro-beta');
    expect(state.enemyStatuses['enemy-a'].statuses.find((status) => status.statusId === 'paralysis')?.stacks).toBe(6);
  });
});
