import { describe, expect, it } from 'vitest';
import { getContinuousDamage, getDetonationDamage, isEffectConditionMet } from '../../src/domain';

describe('generic effect resolution helpers', () => {
  it('resolves per-second damage and status-based conditions without skill ID branches', () => {
    expect(getContinuousDamage({ type: 'damage', target: 'target', magnitude: 52, durationMs: 4000, tags: ['per-second'] }, 4000)).toBe(208);
    expect(isEffectConditionMet({ type: 'status', target: 'target', tags: ['requires:paralysis-stacks:10'] }, [{ statusId: 'paralysis', stacks: 10, remainingMs: 1000 }])).toBe(true);
    expect(getDetonationDamage({ type: 'damage', target: 'target', magnitude: 14, tags: ['detonate', 'per-paralysis-stack'] }, [{ statusId: 'paralysis', stacks: 6, remainingMs: 1000 }])).toBe(84);
  });
});
