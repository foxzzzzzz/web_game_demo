import { describe, expect, it } from 'vitest';
import { convertStatus, extendStatusDuration, getStatusExpiryEffects } from '../../src/domain';

describe('extendStatusDuration', () => {
  it('only extends the requested status and preserves unrelated snapshots', () => {
    const statuses = [
      { statusId: 'ulceration', stacks: 3, remainingMs: 2000 },
      { statusId: 'slow', stacks: 1, remainingMs: 1000 },
    ];

    expect(extendStatusDuration(statuses, 'ulceration', 4000)).toEqual([
      { statusId: 'ulceration', stacks: 3, remainingMs: 6000 },
      { statusId: 'slow', stacks: 1, remainingMs: 1000 },
    ]);
  });

  it('selects expiry follow-ups by status tag without knowing a skill id', () => {
    const effects = [
      { type: 'status' as const, target: 'target' as const, statusId: 'stun', durationMs: 1500, tags: ['on-confusion-expire'] },
      { type: 'trigger' as const, target: 'target' as const, tags: ['on-attack'] },
    ];

    expect(getStatusExpiryEffects(effects, 'confusion')).toEqual([effects[0]]);
  });

  it('converts a configured source status into its target status without a skill branch', () => {
    expect(convertStatus([
      { statusId: 'weakness', stacks: 5, remainingMs: 4000 },
      { statusId: 'slow', stacks: 1, remainingMs: 2000 },
    ], 'weakness', 'muscle-stiffness', 1, 6000)).toEqual([
      { statusId: 'slow', stacks: 1, remainingMs: 2000 },
      { statusId: 'muscle-stiffness', stacks: 1, remainingMs: 6000 },
    ]);
  });
});
