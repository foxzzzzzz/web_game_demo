import { describe, expect, it } from 'vitest';
import { filterEffectsForContext } from '../../src/domain';

describe('generic effect context filter', () => {
  it('keeps only effects whose configured stealth/back-attack/control conditions are satisfied', () => {
    const effects = [
      { type: 'damage' as const, target: 'target' as const, magnitude: 100, tags: ['requires:back-attack'] },
      { type: 'move' as const, target: 'target' as const, tags: ['requires:root', 'pull-to-caster'] },
    ];
    expect(filterEffectsForContext(effects, [{ statusId: 'root', stacks: 1, remainingMs: 1000 }], { tags: ['back-attack'] })).toHaveLength(2);
    expect(filterEffectsForContext(effects, [], { tags: [] })).toEqual([]);
    expect(filterEffectsForContext([{ type: 'damage' as const, target: 'target' as const, tags: ['requires:not-energy-seal'] }], [], { tags: [] })).toHaveLength(1);
  });
});
