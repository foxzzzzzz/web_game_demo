import { describe, expect, it } from 'vitest';

import { runtimeStatusBehavior } from '../../src/config';

describe('runtime status behavior baseline', () => {
  it('keeps confusion, energy seal, and kidney reprisal behavior data-driven', () => {
    expect(runtimeStatusBehavior.confusion?.randomTargeting).toBe(true);
    expect(runtimeStatusBehavior['energy-seal']?.passiveEffectsDisabled).toBe(true);
    expect(runtimeStatusBehavior['kidney-reprisal']?.enemyActionDamagePerStack).toBeGreaterThan(0);
  });
});
