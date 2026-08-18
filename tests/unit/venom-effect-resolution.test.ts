import { describe, expect, it } from 'vitest';
import { detonateStatus, selectConfusionTarget, selectSpreadTargets } from '../../src/domain';

describe('generic venom effect resolution', () => {
  it('detonates only the tagged status, spreads to valid targets, and never lets confusion select itself/dead units', () => {
    expect(detonateStatus({ type: 'damage', target: 'target', magnitude: 16, tags: ['detonate', 'per-bleed-stack', 'clear-status:bleed'] }, [{ statusId: 'bleed', stacks: 3, remainingMs: 1000 }, { statusId: 'slow', stacks: 1, remainingMs: 1000 }])).toEqual({ damage: 48, statuses: [{ statusId: 'slow', stacks: 1, remainingMs: 1000 }] });
    expect(selectSpreadTargets('enemy-a', [{ id: 'enemy-a', alive: true }, { id: 'enemy-b', alive: true }, { id: 'enemy-c', alive: false }, { id: 'enemy-d', alive: true }], 2)).toEqual(['enemy-b', 'enemy-d']);
    expect(selectConfusionTarget('enemy-a', [{ id: 'enemy-a', alive: true }, { id: 'enemy-b', alive: false }, { id: 'enemy-c', alive: true }], () => 0)).toBe('enemy-c');
  });
});
