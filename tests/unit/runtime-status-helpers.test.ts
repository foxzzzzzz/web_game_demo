import { describe, expect, it } from 'vitest';
import { eventMechanicBaselines, gameConfig } from '../../src/config';
import { createInitialGameState, getStatusRestrictionFlags, resolveCounterEffects } from '../../src/domain';
import { createGameStore } from '../../src/store';

describe('runtime status helpers', () => {
  it('derives blocking flags from active status tags as well as configured status traits', () => {
    expect(getStatusRestrictionFlags([{ statusId: 'custom', stacks: 1, remainingMs: 1_000, tags: ['active-skill-blocked', 'movement-blocked'] }], gameConfig)).toEqual({
      activeSkillBlocked: true, movementBlocked: true, actionsBlocked: false,
    });
    expect(getStatusRestrictionFlags([{ statusId: 'silence', stacks: 1, remainingMs: 1_000 }], gameConfig).activeSkillBlocked).toBe(true);
  });

  it('resolves armed counter damage and active passive follow-up without skill IDs', () => {
    const state = { ...createInitialGameState(), phase: 'active' as const, originId: 'strength' as const, unlockedBranchIds: ['strength-counter'], playerStatuses: [{ statusId: 'guard', stacks: 1, remainingMs: 1_000, tags: ['on-melee-hit:counterattack'] }] };
    const result = resolveCounterEffects(state, gameConfig, [{ type: 'damage', target: 'target', tags: ['on-melee-hit', 'counterattack'] }], ['enemy']);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'damage', magnitude: eventMechanicBaselines.counterattackDamage, targetIds: ['enemy'] }),
      expect.objectContaining({ type: 'trigger', statusId: 'sharpen', targetIds: ['player'] }),
    ]));
  });

  it('exposes status restrictions and counter resolution through the shared store', () => {
    const store = createGameStore(gameConfig);
    store.setState({ run: { ...store.getState().run, phase: 'active', playerStatuses: [{ statusId: 'custom', stacks: 1, remainingMs: 1_000, tags: ['active-skill-blocked'] }] } });
    expect(store.getState().getStatusRestrictions().activeSkillBlocked).toBe(true);
    expect(store.getState().resolveCounterEffects([{ type: 'damage', target: 'target', tags: ['counterattack'] }], ['enemy'])).toEqual([]);
  });
});
