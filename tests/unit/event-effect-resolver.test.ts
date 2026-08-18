import { describe, expect, it } from 'vitest';
import { resolveEventEffects } from '../../src/app/event-effect-resolver';

describe('resolveEventEffects', () => {
  it('selects only effects whose configured event tag matches the emitted context', () => {
    const effects = [
      { type: 'status' as const, target: 'target' as const, statusId: 'bleed', tags: ['on-attack'] },
      { type: 'damage' as const, target: 'target' as const, magnitude: 12, tags: ['on-venom-hit'] },
    ];
    expect(resolveEventEffects(effects, 'attack')).toEqual([effects[0]]);
    expect(resolveEventEffects(effects, 'venom-hit')).toEqual([effects[1]]);
    expect(resolveEventEffects([{ type: 'damage' as const, target: 'target' as const, magnitude: 8, tags: ['on-heart-erosion'] }], 'heart-erosion')).toHaveLength(1);
  });
});
