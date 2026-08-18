import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import { getDetonationDamage } from '../../src/domain';

describe('damage executability audit', () => {
  const damageEffects = gameConfig.skills.flatMap((skill) => skill.effects.filter((effect) => effect.type === 'damage').map((effect) => ({ skill, effect })));

  it('gives every configured active damage effect a positive executable magnitude', () => {
    const nonExecutable = damageEffects.filter(({ effect }) => effect.magnitude === undefined || effect.magnitude <= 0);
    expect(nonExecutable.map(({ skill }) => skill.id)).toEqual([]);
  });

  it('gives every per-stack detonation a positive per-layer value and resolves it above zero', () => {
    for (const { effect } of damageEffects.filter(({ effect }) => effect.tags?.includes('detonate'))) {
      const perStackStatus = effect.tags?.map((tag) => /^per-(.+)-stack$/.exec(tag)?.[1]).find((statusId): statusId is string => statusId !== undefined);
      const statuses = perStackStatus ? [{ statusId: perStackStatus, stacks: 2, remainingMs: 1000 }] : [];
      expect(effect.magnitude).toBeGreaterThan(0);
      expect(getDetonationDamage(effect, statuses)).toBeGreaterThan(0);
    }
  });

  it('declares an explicit even split for mixed physical and venom damage', () => {
    const mixed = damageEffects.filter(({ effect }) => effect.tags?.includes('mixed-physical-venom-damage'));
    expect(mixed).not.toEqual([]);
    for (const { effect } of mixed) expect(effect.tags).toContain('damage-split:physical:0.5,venom:0.5');
  });
});
