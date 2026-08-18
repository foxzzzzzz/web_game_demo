import { describe, expect, it } from 'vitest';
import { runtimeConfig } from '../../src/config';
import { validateRuntimeConfig } from '../../src/config/runtime.validation';
import { resolveEnemyDamage } from '../../src/domain';

const target = { physicalDamageReduction: 0.3, venomDamageReduction: 0.2 };

describe('enemy defense damage resolution', () => {
  it('keeps the three externally configured enemy defense baselines within the allowed range', () => {
    expect(runtimeConfig.enemies).toHaveLength(3);
    for (const enemy of runtimeConfig.enemies) {
      expect(enemy.physicalDamageReduction).toBeGreaterThanOrEqual(0);
      expect(enemy.physicalDamageReduction).toBeLessThanOrEqual(0.9);
      expect(enemy.venomDamageReduction).toBeGreaterThanOrEqual(0);
      expect(enemy.venomDamageReduction).toBeLessThanOrEqual(0.9);
    }
    expect(() => validateRuntimeConfig({ ...runtimeConfig, enemies: [{ ...runtimeConfig.enemies[0], physicalDamageReduction: 1 }] })).toThrow('物理伤害减免');
  });

  it('resolves physical, venom and split damage using external reductions without a skill-id branch', () => {
    expect(resolveEnemyDamage({ amount: 100, damageType: 'physical', target })).toBe(70);
    expect(resolveEnemyDamage({ amount: 100, damageType: 'venom', target })).toBe(80);
    expect(resolveEnemyDamage({ amount: 100, damageType: 'physical', target, tags: ['damage-split:physical:0.5,venom:0.5'] })).toBe(75);
  });

  it('applies penetration and target status modifiers while never returning negative damage', () => {
    expect(resolveEnemyDamage({ amount: 100, damageType: 'physical', target, tags: ['ignore-physical-defense:0.35'], targetStatuses: [{ statusId: 'ulceration', stacks: 1, remainingMs: 1000, magnitude: 0.18, tags: ['physical-defense-reduction'] }] })).toBe(92);
    expect(resolveEnemyDamage({ amount: 100, damageType: 'venom', target, targetStatuses: [{ statusId: 'lesion-mark', stacks: 1, remainingMs: 1000, magnitude: 0.3, tags: ['venom-damage-taken'] }] })).toBe(104);
    expect(resolveEnemyDamage({ amount: -10, damageType: 'physical', target })).toBe(0);
  });
});
